import secrets
from datetime import timedelta
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from . import models as m, schemas as s
from .db import get_db
from .security import (current_user, digest, fail, issue_session, passwords, rate,
                       utc, verify_password)
from .services import user_view

router = APIRouter(prefix="/auth", tags=["Authentication"])


def queue_verification(db, user, config):
    for existing in db.scalars(select(m.Verification).where(
            m.Verification.user_id == user.id, m.Verification.used.is_(False))):
        existing.used = True
    for email in db.scalars(select(m.Outbox).where(
            m.Outbox.restaurant_id == user.restaurant_id,
            m.Outbox.kind == "verification", m.Outbox.status.in_(("pending", "failed")))):
        email.body = "[superseded]"
        email.status = "cancelled"
    token = secrets.token_urlsafe(48)
    db.add(m.Verification(token_hash=digest(token), user_id=user.id,
                          expires_at=m.now() + timedelta(hours=24)))
    link = f"{config.public_web_url.rstrip('/')}/verify-email?token={quote(token)}"
    db.add(m.Outbox(restaurant_id=user.restaurant_id, kind="verification", recipient=user.email,
                    subject="Verify your ZAYQORA owner account",
                    body=f"Verify your email within 24 hours:\n{link}\n"
                         "If you did not register, ignore this message."))


@router.post("/register", status_code=201)
def register(data: s.Register, request: Request, db=Depends(get_db)):
    rate(request, "register", 5)
    email = str(data.email).lower()
    if db.scalar(select(m.User).where(m.User.email == email)):
        fail(409, "Email or restaurant slug is already registered.")
    if db.scalar(select(m.Restaurant).where(m.Restaurant.slug == data.slug)):
        fail(409, "Email or restaurant slug is already registered.")
    plan = db.scalar(select(m.Plan).where(m.Plan.active.is_(True)).order_by(m.Plan.max_menu_items))
    restaurant = m.Restaurant(name=data.restaurant_name, slug=data.slug,
                              email=email, plan_id=plan.id if plan else None)
    db.add(restaurant)
    db.flush()
    user = m.User(email=email, full_name=data.full_name,
                  password_hash=passwords.hash(data.password), restaurant_id=restaurant.id)
    db.add(user)
    db.flush()
    config = request.app.state.config
    queue_verification(db, user, config)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        fail(409, "Email or restaurant slug is already registered.")
    configured = config.smtp_configured
    return {"message": "Registration pending email verification. " + (
        "Verification email queued for the independent SMTP worker."
        if configured else "Email provider is not configured; no email has been sent. "
        "Contact the operator to configure SMTP and run the mail worker."),
        "verification_required": True,
        "email_delivery_status": "queued" if configured else "provider_not_configured"}


@router.post("/resend-verification")
def resend_verification(data: s.ResendVerification, request: Request, db=Depends(get_db)):
    rate(request, "resend", 3)
    user = db.scalar(select(m.User).where(m.User.email == str(data.email).lower()).with_for_update())
    config = request.app.state.config
    if user and not user.email_verified:
        queue_verification(db, user, config)
        db.commit()
    return {"message": "If an unverified account exists, a fresh verification link was queued. "
            + ("" if config.smtp_configured else "SMTP is not configured; no email has been sent."),
            "email_delivery_status": "queued" if config.smtp_configured else "provider_not_configured"}


@router.post("/verify-email")
def verify_email(data: s.Verify, request: Request, db=Depends(get_db)):
    rate(request, "verify", 20)
    verification = db.scalar(select(m.Verification).where(
        m.Verification.token_hash == digest(data.token)))
    if not verification:
        fail(400, "Invalid or expired verification token.")
    user = db.scalar(select(m.User).where(m.User.id == verification.user_id).with_for_update())
    verification = db.scalar(select(m.Verification).where(
        m.Verification.token_hash == digest(data.token))
        .execution_options(populate_existing=True).with_for_update())
    if not verification or verification.used or utc(verification.expires_at) <= m.now():
        fail(400, "Invalid or expired verification token.")
    user.email_verified = True
    verification.used = True
    # Clear delivered verification secrets from the outbox.
    for email in db.scalars(select(m.Outbox).where(
            m.Outbox.restaurant_id == user.restaurant_id, m.Outbox.kind == "verification")):
        email.body = "[verification completed]"
        if email.status == "pending":
            email.status = "cancelled"
    db.commit()
    return {"message": "Email verified. You can now sign in."}


@router.post("/login")
def login(data: s.Login, request: Request, db=Depends(get_db)):
    rate(request, "login", 10)
    user = db.scalar(select(m.User).where(m.User.email == str(data.email).lower()))
    if not verify_password(user.password_hash if user else None, data.password):
        fail(401, "Invalid email or password.")
    if not user.email_verified:
        fail(403, "Email verification is required.")
    if user.restaurant_id:
        restaurant = db.get(m.Restaurant, user.restaurant_id)
        if not restaurant or restaurant.status != "active":
            fail(403, "Restaurant is suspended.")
    token = issue_session(db, user, request.app.state.config)
    db.commit()
    return {"access_token": token, "token_type": "bearer", "user": user_view(user)}


@router.get("/me")
def me(user=Depends(current_user)):
    return user_view(user)


@router.post("/logout")
def logout(request: Request, user=Depends(current_user), db=Depends(get_db)):
    request.state.session.revoked = True
    db.commit()
    return {"message": "Signed out; session revoked."}
