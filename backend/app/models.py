import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, ForeignKeyConstraint, Integer, Numeric,
    String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


def hours():
    return {day: {"open": "00:00", "close": "23:59", "closed": False}
            for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}


class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    max_menu_items: Mapped[int] = mapped_column(Integer, default=30)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Restaurant(Base):
    __tablename__ = "restaurants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    tagline: Mapped[str] = mapped_column(String(250), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    cuisine: Mapped[str] = mapped_column(String(100), default="Pakistani")
    city: Mapped[str] = mapped_column(String(100), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    email: Mapped[str] = mapped_column(String(254), default="")
    currency: Mapped[str] = mapped_column(String(3), default="PKR")
    timezone: Mapped[str] = mapped_column(String(60), default="Asia/Karachi")
    logo_url: Mapped[str] = mapped_column(Text, default="")
    hero_image_url: Mapped[str] = mapped_column(Text, default="/food/hero.jpg")
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    allow_pickup: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    minimum_order: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)
    opening_hours: Mapped[dict] = mapped_column(JSON, default=hours)
    reservation_duration_minutes: Mapped[int] = mapped_column(Integer, default=90)
    reservation_buffer_minutes: Mapped[int] = mapped_column(Integer, default=15)
    reservation_days_ahead: Mapped[int] = mapped_column(Integer, default=30)
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("plans.id"), nullable=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    full_name: Mapped[str] = mapped_column(String(150))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(30), default="owner")
    restaurant_id: Mapped[str | None] = mapped_column(ForeignKey("restaurants.id"))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Session(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Verification(Base):
    __tablename__ = "verifications"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("id", "restaurant_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)
    published: Mapped[bool] = mapped_column(Boolean, default=False)


class MenuItem(Base):
    __tablename__ = "menu_items"
    __table_args__ = (
        ForeignKeyConstraint(["category_id", "restaurant_id"],
                             ["categories.id", "categories.restaurant_id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id"), index=True)
    category_id: Mapped[str] = mapped_column(String(36))
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    variant_required: Mapped[bool] = mapped_column(Boolean, default=False)
    variants: Mapped[list] = mapped_column(JSON, default=list)
    modifiers: Mapped[list] = mapped_column(JSON, default=list)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("restaurant_id", "idempotency_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id"), index=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True)
    tracking_hash: Mapped[str] = mapped_column(String(64), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(128))
    payload_hash: Mapped[str] = mapped_column(String(64))
    creation_response: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="PENDING")
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")
    payment_method: Mapped[str] = mapped_column(String(20), default="cash")
    fulfilment: Mapped[str] = mapped_column(String(20))
    customer_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(254), default="")
    phone: Mapped[str] = mapped_column(String(50))
    address: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    items: Mapped[list] = mapped_column(JSON)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="PKR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    history: Mapped[list] = mapped_column(JSON, default=list)


class DiningTable(Base):
    __tablename__ = "dining_tables"
    __table_args__ = (UniqueConstraint("id", "restaurant_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    capacity: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        ForeignKeyConstraint(["table_id", "restaurant_id"],
                             ["dining_tables.id", "dining_tables.restaurant_id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id"), index=True)
    reference: Mapped[str] = mapped_column(String(30), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="REQUESTED")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    party_size: Mapped[int] = mapped_column(Integer)
    customer_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(254), default="")
    phone: Mapped[str] = mapped_column(String(50))
    notes: Mapped[str] = mapped_column(Text, default="")
    table_id: Mapped[str] = mapped_column(String(36))


class Audit(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    restaurant_id: Mapped[str | None] = mapped_column(ForeignKey("restaurants.id"))
    kind: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Outbox(Base):
    __tablename__ = "outbox"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    restaurant_id: Mapped[str | None] = mapped_column(ForeignKey("restaurants.id"), index=True)
    kind: Mapped[str] = mapped_column(String(50))
    recipient: Mapped[str] = mapped_column(String(254))
    subject: Mapped[str] = mapped_column(String(250))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
