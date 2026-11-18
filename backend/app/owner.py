import io
import warnings
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, or_, select

from . import models as m, schemas as s
from .config import ROOT
from .db import get_db
from .security import fail, owner, rate, utc
from .media import store_image
from .services import (HOLDING, ORDER_TRANSITIONS, RESERVATION_TRANSITIONS, apply_patch,
                       audit, category_view, enforce_cap, money, normalize_options,
                       order_view, page, publish_check, restaurant_lock, scoped, serialize,
                       queue_status_email)

router = APIRouter(tags=["Owner"], dependencies=[Depends(owner)])


@router.get("/restaurant")
def get_restaurant(user=Depends(owner), db=Depends(get_db)):
    return serialize(db.get(m.Restaurant, user.restaurant_id))


@router.patch("/restaurant")
def update_restaurant(data: s.RestaurantPatch, user=Depends(owner), db=Depends(get_db)):
    restaurant = restaurant_lock(db, user.restaurant_id)
    apply_patch(restaurant, data)
    if restaurant.published:
        publish_check(db, restaurant)
    audit(db, user, "restaurant.updated", restaurant.id, details={"fields": sorted(data.model_fields_set)})
    db.commit()
    return serialize(restaurant)


@router.get("/menu/categories")
def categories(user=Depends(owner), db=Depends(get_db)):
    result = db.scalars(select(m.Category).where(m.Category.restaurant_id == user.restaurant_id)
                        .order_by(m.Category.position, m.Category.id))
    return {"items": [category_view(db, category) for category in result]}


@router.post("/menu/categories", status_code=201)
def create_category(data: s.CategoryCreate, user=Depends(owner), db=Depends(get_db)):
    restaurant_lock(db, user.restaurant_id)
    category = m.Category(restaurant_id=user.restaurant_id, **data.model_dump())
    db.add(category)
    db.commit()
    return category_view(db, category)


@router.patch("/menu/categories/{category_id}")
def update_category(category_id: str, data: s.CategoryPatch,
                    user=Depends(owner), db=Depends(get_db)):
    restaurant_lock(db, user.restaurant_id)
    category = scoped(db, m.Category, category_id, user.restaurant_id)
    apply_patch(category, data)
    db.commit()
    return category_view(db, category)


@router.post("/menu/items", status_code=201)
def create_item(data: s.ItemCreate, user=Depends(owner), db=Depends(get_db)):
    restaurant = restaurant_lock(db, user.restaurant_id)
    scoped(db, m.Category, data.category_id, user.restaurant_id)
    enforce_cap(db, restaurant, adding=1)
    values = data.model_dump()
    values["variants"] = normalize_options(data.variants)
    values["modifiers"] = normalize_options(data.modifiers)
    if data.variant_required and not values["variants"]:
        fail(422, "A variant-required item needs at least one variant.")
    item = m.MenuItem(restaurant_id=user.restaurant_id, **values)
    db.add(item)
    db.commit()
    return serialize(item)


@router.patch("/menu/items/{item_id}")
def update_item(item_id: str, data: s.ItemPatch, user=Depends(owner), db=Depends(get_db)):
    restaurant_lock(db, user.restaurant_id)
    item = scoped(db, m.MenuItem, item_id, user.restaurant_id)
    if data.category_id:
        scoped(db, m.Category, data.category_id, user.restaurant_id)
    apply_patch(item, data)
    if item.variant_required and not item.variants:
        fail(422, "A variant-required item needs at least one variant.")
    db.commit()
    return serialize(item)


@router.get("/orders")
def orders(page_number: int = Query(1, alias="page", ge=1),
           page_size: int = Query(20, ge=1, le=100), status: str = "", q: str = "",
           fulfilment: Literal["pickup", "delivery"] | None = None,
           payment_status: Literal["paid", "unpaid"] | None = None,
           from_date: date | None = None, to_date: date | None = None,
           active_only: bool = False,
           user=Depends(owner), db=Depends(get_db)):
    query = select(m.Order).where(m.Order.restaurant_id == user.restaurant_id)
    if status:
        query = query.where(m.Order.status == status)
    if fulfilment:
        query = query.where(m.Order.fulfilment == fulfilment)
    if payment_status:
        query = query.where(m.Order.payment_status == payment_status)
    if from_date and to_date and from_date > to_date:
        fail(422, "from_date must be on or before to_date.")
    zone = ZoneInfo("Asia/Karachi")
    if from_date:
        query = query.where(m.Order.created_at >= utc(datetime.combine(from_date, time.min, zone)))
    if to_date:
        if to_date == date.max:
            fail(422, "to_date exceeds the supported date range.")
        query = query.where(m.Order.created_at < utc(datetime.combine(
            to_date + timedelta(days=1), time.min, zone)))
    if active_only:
        query = query.where(m.Order.status.not_in(("COMPLETED", "REJECTED", "CANCELLED")))
    if q:
        term = "%" + q[:100].replace("%", r"\%").replace("_", r"\_") + "%"
        query = query.where(or_(m.Order.reference.ilike(term, escape="\\"),
                               m.Order.customer_name.ilike(term, escape="\\")))
    restaurant = db.get(m.Restaurant, user.restaurant_id)
    return page(db, query.order_by(m.Order.created_at.desc()), page_number, page_size,
                lambda order: order_view(order, restaurant))


@router.get("/orders/{order_id}")
def get_order(order_id: str, user=Depends(owner), db=Depends(get_db)):
    return order_view(scoped(db, m.Order, order_id, user.restaurant_id),
                      db.get(m.Restaurant, user.restaurant_id))


@router.patch("/orders/{order_id}/status")
def order_status(order_id: str, data: s.StatusInput, user=Depends(owner), db=Depends(get_db)):
    restaurant = restaurant_lock(db, user.restaurant_id)
    order = scoped(db, m.Order, order_id, user.restaurant_id, lock=True)
    if data.status not in ORDER_TRANSITIONS.get(order.status, set()):
        fail(409, f"Cannot move from {order.status} to {data.status}.")
    if data.status in {"CANCELLED", "REJECTED"} and order.payment_status == "paid":
        fail(409, "Paid orders cannot be cancelled: cash refunds are not implemented.")
    if data.status in {"CANCELLED", "REJECTED"} and len(data.reason) < 3:
        fail(422, "A reason of at least three characters is required to reject or cancel an order.",
             "reason_required")
    if data.status == "OUT_FOR_DELIVERY" and order.fulfilment != "delivery":
        fail(409, "Pickup orders cannot be out for delivery.")
    if data.status == "COMPLETED":
        expected = "READY" if order.fulfilment == "pickup" else "OUT_FOR_DELIVERY"
        if order.status != expected:
            fail(409, f"{order.fulfilment} completion requires {expected}.")
        if order.payment_status != "paid":
            fail(409, "Record the cash receipt before completing the order.")
    previous = order.status
    order.status = data.status
    order.history = [*order.history, {"status": data.status, "created_at": m.now().isoformat(),
                                      "reason": data.reason}]
    audit(db, user, "order.status", user.restaurant_id, data.reason,
          {"order_id": order.id, "from": previous, "to": data.status})
    queue_status_email(db, restaurant, order, "order_status")
    db.commit()
    return order_view(order, restaurant)


@router.post("/orders/{order_id}/cash-payment")
def cash_payment(order_id: str, user=Depends(owner), db=Depends(get_db)):
    restaurant = restaurant_lock(db, user.restaurant_id)
    order = scoped(db, m.Order, order_id, user.restaurant_id, lock=True)
    if order.status in {"CANCELLED", "REJECTED"}:
        fail(409, "Cannot collect cash on cancelled or rejected orders.")
    if order.payment_status != "paid":
        order.payment_status = "paid"
        audit(db, user, "order.cash_received", user.restaurant_id,
              "Owner explicitly recorded cash receipt.",
              {"order_id": order.id, "amount": money(order.total), "currency": order.currency})
        queue_status_email(db, restaurant, order, "cash_receipt")
    db.commit()
    return order_view(order, restaurant)


@router.get("/reservations")
def reservations(page_number: int = Query(1, alias="page", ge=1),
                 page_size: int = Query(20, ge=1, le=100), status: str = "",
                 user=Depends(owner), db=Depends(get_db)):
    query = select(m.Reservation).where(m.Reservation.restaurant_id == user.restaurant_id)
    if status:
        query = query.where(m.Reservation.status == status)
    return page(db, query.order_by(m.Reservation.starts_at), page_number, page_size)


@router.patch("/reservations/{reservation_id}/status")
def reservation_status(reservation_id: str, data: s.StatusInput,
                       user=Depends(owner), db=Depends(get_db)):
    restaurant = restaurant_lock(db, user.restaurant_id)
    reservation = scoped(db, m.Reservation, reservation_id, user.restaurant_id, lock=True)
    if data.status not in RESERVATION_TRANSITIONS.get(reservation.status, set()):
        fail(409, f"Cannot move from {reservation.status} to {data.status}.")
    if data.status in {"DECLINED", "CANCELLED"} and len(data.reason) < 3:
        fail(422, "A reason of at least three characters is required to decline or cancel a reservation.",
             "reason_required")
    old = reservation.status
    reservation.status = data.status
    audit(db, user, "reservation.status", user.restaurant_id, data.reason,
          {"reservation_id": reservation.id, "from": old, "to": data.status})
    queue_status_email(db, restaurant, reservation, "reservation_status")
    db.commit()
    return serialize(reservation)


@router.get("/inquiries")
def inquiries(page_number: int = Query(1, alias="page", ge=1),
              page_size: int = Query(20, ge=1, le=100),
              user=Depends(owner), db=Depends(get_db)):
    query = select(m.ContactInquiry).where(m.ContactInquiry.restaurant_id == user.restaurant_id)
    return page(db, query.order_by(m.ContactInquiry.created_at.desc(), m.ContactInquiry.id),
                page_number, page_size)


@router.patch("/inquiries/{inquiry_id}")
def inquiry_status(inquiry_id: str, data: s.InquiryStatus,
                   user=Depends(owner), db=Depends(get_db)):
    restaurant_lock(db, user.restaurant_id)
    inquiry = scoped(db, m.ContactInquiry, inquiry_id, user.restaurant_id, lock=True)
    previous = inquiry.status
    inquiry.status = data.status
    audit(db, user, "inquiry.status", user.restaurant_id,
          details={"inquiry_id": inquiry.id, "from": previous, "to": data.status})
    db.commit()
    return serialize(inquiry)


@router.get("/tables")
def tables(user=Depends(owner), db=Depends(get_db)):
    return {"items": [serialize(table) for table in db.scalars(select(m.DiningTable).where(
        m.DiningTable.restaurant_id == user.restaurant_id).order_by(m.DiningTable.name))]}


@router.post("/tables", status_code=201)
def create_table(data: s.TableCreate, user=Depends(owner), db=Depends(get_db)):
    restaurant_lock(db, user.restaurant_id)
    table = m.DiningTable(restaurant_id=user.restaurant_id, **data.model_dump())
    db.add(table)
    db.commit()
    return serialize(table)


@router.patch("/tables/{table_id}")
def update_table(table_id: str, data: s.TablePatch, user=Depends(owner), db=Depends(get_db)):
    restaurant_lock(db, user.restaurant_id)
    table = scoped(db, m.DiningTable, table_id, user.restaurant_id)
    if (data.active is False or data.capacity is not None and data.capacity < table.capacity):
        held = db.scalar(select(m.Reservation.id).where(
            m.Reservation.restaurant_id == user.restaurant_id,
            m.Reservation.table_id == table.id, m.Reservation.status.in_(HOLDING),
            m.Reservation.ends_at > m.now()).limit(1))
        if held:
            fail(409, "Cannot reduce or deactivate a table with active future reservations.")
    apply_patch(table, data)
    db.commit()
    return serialize(table)


def report(db, restaurant, from_date, to_date):
    if to_date < from_date or (to_date - from_date).days > 366:
        fail(422, "Reporting period must be ordered and no longer than 367 days.")
    zone = ZoneInfo(restaurant.timezone)
    starts = utc(datetime.combine(from_date, time.min, zone))
    ends = utc(datetime.combine(to_date + timedelta(days=1), time.min, zone))
    orders = list(db.scalars(select(m.Order).where(
        m.Order.restaurant_id == restaurant.id, m.Order.created_at >= starts,
        m.Order.created_at < ends).order_by(m.Order.created_at.desc())))
    eligible = [order for order in orders if order.status == "COMPLETED" and order.payment_status == "paid"]
    gross = sum((order.total for order in eligible), Decimal("0"))
    tax = sum((order.tax for order in eligible), Decimal("0"))
    items = {}
    for order in eligible:
        # Immutable totals identify included tax; cumulative rounding preserves every penny.
        included_tax = order.subtotal + order.delivery_fee + order.tax - order.total
        cumulative_amount = Decimal("0")
        allocated_tax = Decimal("0")
        for line in order.items:
            line_amount = Decimal(line["line_total"])
            cumulative_amount += line_amount
            cumulative_tax = (Decimal(money(included_tax * cumulative_amount / order.subtotal))
                              if order.subtotal else Decimal("0"))
            item = items.setdefault(line["menu_item_id"], {"name": line["name"], "quantity": 0,
                                                         "revenue": Decimal("0")})
            item["quantity"] += line["quantity"]
            item["revenue"] += line_amount - (cumulative_tax - allocated_tax)
            allocated_tax = cumulative_tax
    top = sorted(items.values(), key=lambda item: item["revenue"], reverse=True)[:10]
    upcoming = db.scalar(select(func.count()).select_from(m.Reservation).where(
        m.Reservation.restaurant_id == restaurant.id, m.Reservation.status.in_(HOLDING),
        m.Reservation.starts_at >= m.now()))
    today = m.now().astimezone(zone).date()
    return {"orders_today": sum(utc(order.created_at).astimezone(zone).date() == today for order in orders),
            "gross_sales": money(gross), "net_sales": money(gross - tax),
            "pending_orders": sum(order.status in {"PENDING", "CONFIRMED", "PREPARING", "READY",
                                                  "OUT_FOR_DELIVERY"} for order in orders),
            "average_order_value": money(gross / len(eligible) if eligible else Decimal("0")),
            "upcoming_reservations": upcoming,
            "recent_orders": [order_view(order, restaurant) for order in orders[:5]],
            "top_items": [{**item, "revenue": money(item["revenue"])} for item in top],
            "definitions": {
                "gross_sales": "Total including tax and delivery, completed and cash-paid orders only.",
                "net_sales": "Gross sales less tax; includes delivery fees.",
                "average_order_value": "Gross sales / eligible completed cash-paid orders.",
                "top_items": "Pre-tax item snapshot revenue of completed cash-paid orders.",
                "period": "Orders created within inclusive restaurant-local dates.",
                "orders_today": "All orders created today within the selected period.",
                "upcoming_reservations": "All future requested, confirmed or seated reservations.",
            }}


@router.get("/reports/dashboard")
def dashboard(user=Depends(owner), db=Depends(get_db)):
    restaurant = db.get(m.Restaurant, user.restaurant_id)
    today = m.now().astimezone(ZoneInfo(restaurant.timezone)).date()
    return report(db, restaurant, today, today)


@router.get("/reports/sales")
def sales(from_date: date, to_date: date, user=Depends(owner), db=Depends(get_db)):
    restaurant = db.get(m.Restaurant, user.restaurant_id)
    return {**report(db, restaurant, from_date, to_date),
            "from_date": from_date.isoformat(), "to_date": to_date.isoformat()}


@router.get("/notifications")
def notifications(page_number: int = Query(1, alias="page", ge=1),
                  page_size: int = Query(20, ge=1, le=100), user=Depends(owner), db=Depends(get_db)):
    def view(message):
        return {key: value for key, value in serialize(message).items()
                if key in {"id", "kind", "subject", "status", "created_at"}}
    return page(db, select(m.Outbox).where(m.Outbox.restaurant_id == user.restaurant_id)
                .order_by(m.Outbox.created_at.desc()), page_number, page_size, view)


@router.post("/media", status_code=201)
def upload_media(request: Request, file: UploadFile = File(...), user=Depends(owner)):
    rate(request, "media", 20)
    config = request.app.state.config
    if config.media_backend == "object_store_not_configured":
        fail(503, "Durable object storage is not configured. Set BLOB_READ_WRITE_TOKEN for a dedicated "
             "public Vercel Blob store. Local uploads are development-only.",
             "media_storage_unavailable")
    content = file.file.read(4 * 1024 * 1024 + 1)
    if len(content) > 4 * 1024 * 1024:
        fail(413, "Images must be at most 4 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    fail(422, "Only JPEG, PNG and WebP images are supported.")
                if image.width * image.height > 20_000_000:
                    fail(422, "Image dimensions exceed 20 megapixels.")
                image.verify()
            with Image.open(io.BytesIO(content)) as image:
                image = image.convert("RGB")
                image.thumbnail((2400, 2400))
                output = io.BytesIO()
                image.save(output, "JPEG", quality=88)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
            Image.DecompressionBombWarning, ValueError):
        fail(422, "Invalid or unsafe image.")
    return {"url": store_image(config, user.restaurant_id, output.getvalue())}
