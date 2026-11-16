import base64
import hashlib
import hmac
import json
import secrets
import time
from collections import defaultdict, deque
from datetime import timedelta, timezone
from threading import Lock

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from .db import get_db
from .models import Restaurant, Session, User, now

passwords = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
_dummy = passwords.hash(secrets.token_urlsafe(32))
bearer = HTTPBearer(auto_error=False)


def fail(status, detail, code=None):
    raise HTTPException(status, detail=detail, headers={"X-Error-Code": code} if code else None)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def verify_password(stored, password):
    try:
        return passwords.verify(stored or _dummy, password) and bool(stored)
    except (VerificationError, InvalidHashError):
        return False


def issue_session(db, user, config):
    token = secrets.token_urlsafe(48)
    db.add(Session(token_hash=digest(token), user_id=user.id,
                   expires_at=now() + timedelta(hours=config.session_hours)))
    return token


def current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                 db=Depends(get_db)):
    if not credentials:
        fail(401, "Authentication required.")
    session = db.get(Session, digest(credentials.credentials))
    if not session or session.revoked or utc(session.expires_at) <= now():
        fail(401, "Session expired or revoked.")
    user = db.get(User, session.user_id)
    if not user or not user.email_verified:
        fail(401, "Verified account required.")
    request.state.session = session
    return user


def owner(user=Depends(current_user), db=Depends(get_db)):
    if user.role != "owner" or not user.restaurant_id:
        fail(403, "Restaurant owner access required.")
    restaurant = db.get(Restaurant, user.restaurant_id)
    if not restaurant or restaurant.status != "active":
        fail(403, "Restaurant is suspended.")
    return user


def admin(user=Depends(current_user)):
    if user.role != "platform_admin":
        fail(403, "Platform administrator access required.")
    return user


def sign_quote(data, secret):
    body = base64.urlsafe_b64encode(canonical(data).encode()).decode().rstrip("=")
    signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def read_quote(token, secret):
    try:
        body, signature = token.split(".")
        expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if data["exp"] <= time.time():
            fail(409, "Quote expired. Request and confirm a new quote.", "quote_expired")
        return data
    except (ValueError, KeyError, TypeError):
        fail(409, "Invalid quote. Request and confirm a new quote.", "quote_invalid")


class RateLimiter:
    def __init__(self):
        self.buckets = defaultdict(deque)
        self.lock = Lock()

    def check(self, key, limit, seconds=60):
        clock = time.monotonic()
        with self.lock:
            bucket = self.buckets[key]
            while bucket and bucket[0] <= clock - seconds:
                bucket.popleft()
            if len(bucket) >= limit:
                fail(429, "Too many requests. Try again later.")
            bucket.append(clock)
            if len(self.buckets) > 10000:
                stale = [k for k, v in self.buckets.items() if not v or v[-1] < clock - 3600]
                for k in stale:
                    self.buckets.pop(k, None)


def rate(request: Request, bucket: str, limit: int):
    # Do not trust caller-supplied forwarding headers.
    address = request.client.host if request.client else "unknown"
    request.app.state.limiter.check((bucket, address), limit)
