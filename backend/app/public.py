import secrets
import time
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import select

from . import models as m, schemas as s
from .db import get_db
from .security import canonical, digest, fail, rate, read_quote, sign_quote, utc
from .services import (category_view, choose_table, money, order_view, page,
                       public_restaurant, quote_binding, quote_data, reference,
                       reservation_window, serialize)

router = APIRouter(prefix="/public", tags=["Guest storefront"])


@router.get("/restaurants")
def restaurants(page_number: int = Query(1, alias="page", ge=1),
                page_size: int = Query(20, ge=1, le=100), db=Depends(get_db)):
    return page(db, select(m.Restaurant).where(m.Restaurant.published.is_(True),
                m.Restaurant.status == "active").order_by(m.Restaurant.name),
                page_number, page_size)


@router.get("/plans")
def plans(db=Depends(get_db)):
    return {"items": [serialize(p) for p in db.scalars(select(m.Plan).where(
        m.Plan.active.is_(True)).order_by(m.Plan.max_menu_items))]}


@router.get("/restaurants/{slug}")
def restaurant(slug: str, db=Depends(get_db)):
    return serialize(public_restaurant(db, slug))


@router.get("/restaurants/{slug}/menu")
def menu(slug: str, db=Depends(get_db)):
    tenant = public_restaurant(db, slug)
    categories = db.scalars(select(m.Category).where(m.Category.restaurant_id == tenant.id,
                           m.Category.published.is_(True)).order_by(m.Category.position, m.Category.id))
    return {"categories": [category_view(db, category, True) for category in categories]}


@router.post("/restaurants/{slug}/quote")
def quote(slug: str, data: s.QuoteInput, request: Request, db=Depends(get_db)):
    rate(request, "quote", 60)
    tenant = public_restaurant(db, slug)
    result = quote_data(db, tenant, data)
    config = request.app.state.config
    token = sign_quote({"binding": quote_binding(tenant, data, result),
                        "exp": int(time.time()) + config.quote_minutes * 60},
                       config.secret_key)
    return {**result, "quote_token": token}


@router.post("/restaurants/{slug}/orders", status_code=201)
def create_order(slug: str, data: s.OrderInput, request: Request,
                 idempotency_key: str = Header(alias="Idempotency-Key", min_length=8, max_length=128),
                 db=Depends(get_db)):
    # The same tenant lock serializes checkout, menu changes, suspension and reservations.
    tenant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == slug).with_for_update())
    if not tenant:
        fail(404, "Restaurant not found.")
    payload_hash = digest(canonical(data.model_dump(mode="json")))
    previous = db.scalar(select(m.Order).where(m.Order.restaurant_id == tenant.id,
                         m.Order.idempotency_key == idempotency_key))
    if previous:
        if previous.payload_hash != payload_hash:
            fail(409, "Idempotency key was already used with a different payload.",
                 "idempotency_conflict")
        return previous.creation_response
    rate(request, "checkout", 20)
    public_restaurant(db, slug)
    config = request.app.state.config
    signed = read_quote(data.quote_token, config.secret_key)
    result = quote_data(db, tenant, data)
    if signed["binding"] != quote_binding(tenant, data, result):
        fail(409, "Cart or prices changed. Request and explicitly confirm a new quote.",
             "quote_changed")
    tracking = secrets.token_urlsafe(48)
    order = m.Order(
        restaurant_id=tenant.id, reference=reference("ZQ"), tracking_hash=digest(tracking),
        idempotency_key=idempotency_key, payload_hash=payload_hash,
        fulfilment=data.fulfilment, customer_name=data.customer_name,
        email=str(data.email), phone=data.phone, address=data.address, notes=data.notes,
        **result,
        history=[{"status": "PENDING", "created_at": m.now().isoformat(), "reason": ""}],
    )
    db.add(order)
    db.flush()
    response = {**order_view(order), "tracking_token": tracking}
    order.creation_response = response
    if data.email:
        db.add(m.Outbox(restaurant_id=tenant.id, kind="order", recipient=str(data.email),
                        subject=f"{tenant.name}: order {order.reference}",
                        body=f"Your cash {order.fulfilment} order was received. "
                             f"Total: PKR {money(order.total)}. "
                             "Payment is due in cash; this is not a payment receipt."))
    db.commit()
    return response


@router.get("/orders/{tracking_token}")
def tracking(tracking_token: str, request: Request, db=Depends(get_db)):
    rate(request, "tracking", 120)
    order = db.scalar(select(m.Order).where(m.Order.tracking_hash == digest(tracking_token)))
    if not order:
        fail(404, "Order not found.")
    return order_view(order, public=True)


@router.get("/restaurants/{slug}/availability")
def availability(slug: str, date_value: date = Query(alias="date"),
                 party_size: int = Query(ge=1, le=30), db=Depends(get_db)):
    tenant = public_restaurant(db, slug)
    local_now = m.now().astimezone(ZoneInfo(tenant.timezone))
    if date_value < local_now.date() or date_value > local_now.date() + timedelta(
            days=tenant.reservation_days_ahead):
        fail(422, "Date is outside the advance booking window.")
    day = tenant.opening_hours[("mon", "tue", "wed", "thu", "fri", "sat", "sun")[date_value.weekday()]]
    if day["closed"]:
        return {"slots": []}
    zone = ZoneInfo(tenant.timezone)
    start = datetime.combine(date_value, datetime.strptime(day["open"], "%H:%M").time(), zone)
    close = datetime.combine(date_value, datetime.strptime(day["close"], "%H:%M").time(), zone)
    slots = []
    while start + timedelta(minutes=tenant.reservation_duration_minutes) <= close:
        end = start + timedelta(minutes=tenant.reservation_duration_minutes)
        if start > local_now and choose_table(db, tenant, utc(start), utc(end), party_size):
            slots.append({"starts_at": utc(start).isoformat(), "ends_at": utc(end).isoformat()})
        start += timedelta(minutes=30)
    return {"slots": slots}


@router.post("/restaurants/{slug}/reservations", status_code=201)
def create_reservation(slug: str, data: s.ReservationInput, request: Request, db=Depends(get_db)):
    rate(request, "reservation", 10)
    tenant = public_restaurant(db, slug, lock=True)
    starts, ends = reservation_window(tenant, data.starts_at, data.party_size)
    table = choose_table(db, tenant, starts, ends, data.party_size)
    if not table:
        fail(409, "No suitable table is available for that time.")
    reservation = m.Reservation(
        restaurant_id=tenant.id, reference=reference("RS"), starts_at=starts, ends_at=ends,
        table_id=table.id, **data.model_dump(exclude={"starts_at", "consent"}))
    db.add(reservation)
    db.flush()
    result = serialize(reservation)
    if data.email:
        db.add(m.Outbox(restaurant_id=tenant.id, kind="reservation", recipient=str(data.email),
                        subject=f"{tenant.name}: reservation request {reservation.reference}",
                        body="Your table request has been received and is awaiting owner confirmation."))
    db.commit()
    return result
