import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from . import models as m
from .schemas import WebsiteSettings
from .security import canonical, digest, fail, utc

CENT = Decimal("0.01")
ORDER_TRANSITIONS = {
    "PENDING": {"CONFIRMED", "REJECTED", "CANCELLED"},
    "CONFIRMED": {"PREPARING", "CANCELLED"},
    "PREPARING": {"READY", "CANCELLED"},
    "READY": {"OUT_FOR_DELIVERY", "COMPLETED"},
    "OUT_FOR_DELIVERY": {"COMPLETED"}, "COMPLETED": set(),
    "REJECTED": set(), "CANCELLED": set(),
}
RESERVATION_TRANSITIONS = {
    "REQUESTED": {"CONFIRMED", "DECLINED", "CANCELLED"},
    "CONFIRMED": {"SEATED", "CANCELLED", "NO_SHOW"},
    "SEATED": {"COMPLETED"}, "COMPLETED": set(), "CANCELLED": set(),
    "DECLINED": set(), "NO_SHOW": set(),
}
HOLDING = ("REQUESTED", "CONFIRMED", "SEATED")


def money(value):
    return f"{Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP):.2f}"


def serialize(obj, exclude=()):
    values = {}
    for column in obj.__table__.columns:
        key = column.key
        if key in exclude or key == "restaurant_id":
            continue
        value = getattr(obj, key)
        if isinstance(obj, m.Restaurant) and key == "website_settings":
            value = WebsiteSettings.model_validate(value or {}).model_dump(mode="json")
        elif isinstance(value, Decimal):
            value = money(value)
        elif isinstance(value, datetime):
            value = utc(value).isoformat()
        values[key] = value
    return values


def user_view(user):
    return {key: getattr(user, key) for key in
            ("id", "email", "full_name", "role", "restaurant_id", "email_verified")}


def order_view(order, public=False):
    excluded = {"tracking_hash", "idempotency_key", "payload_hash", "creation_response"}
    if public:
        excluded |= {"customer_name", "email", "phone", "address", "notes"}
    result = serialize(order, excluded)
    if public:
        result["items"] = [{**item, "notes": ""} for item in order.items]
        result["history"] = [{"status": event["status"], "created_at": event["created_at"],
                              "reason": ""} for event in order.history]
    return result


def category_view(db, category, public=False):
    query = select(m.MenuItem).where(m.MenuItem.category_id == category.id,
                                    m.MenuItem.restaurant_id == category.restaurant_id)
    if public:
        query = query.where(m.MenuItem.published.is_(True))
    return {**serialize(category), "items": [serialize(item) for item in db.scalars(query)]}


def public_restaurant(db, slug, lock=False):
    query = select(m.Restaurant).where(m.Restaurant.slug == slug)
    if lock:
        query = query.with_for_update()
    restaurant = db.scalar(query)
    if not restaurant or restaurant.is_demo or not restaurant.published or restaurant.status != "active":
        fail(404, "Restaurant not found.")
    return restaurant


def scoped(db, model, item_id, restaurant_id, lock=False):
    query = select(model).where(model.id == item_id, model.restaurant_id == restaurant_id)
    if lock:
        query = query.with_for_update()
    item = db.scalar(query)
    if not item:
        fail(404, "Resource not found.")
    return item


def restaurant_lock(db, restaurant_id):
    restaurant = db.scalar(select(m.Restaurant).where(m.Restaurant.id == restaurant_id)
                           .execution_options(populate_existing=True).with_for_update())
    if not restaurant or restaurant.status != "active":
        fail(403, "Restaurant is suspended.")
    return restaurant


def check_open(restaurant, starts, ends=None):
    zone = ZoneInfo(restaurant.timezone)
    local = utc(starts).astimezone(zone)
    day = restaurant.opening_hours[("mon", "tue", "wed", "thu", "fri", "sat", "sun")[local.weekday()]]
    if day["closed"]:
        fail(409, "Restaurant is closed at the requested time.")
    opening = datetime.combine(local.date(), datetime.strptime(day["open"], "%H:%M").time(), zone)
    closing = datetime.combine(local.date(), datetime.strptime(day["close"], "%H:%M").time(), zone)
    end_local = utc(ends).astimezone(zone) if ends else local
    if local < opening or local >= closing or end_local > closing:
        fail(409, "Requested time is outside restaurant opening hours.")


def quote_data(db, restaurant, data):
    check_open(restaurant, m.now())
    if not getattr(restaurant, "allow_" + data.fulfilment):
        fail(409, "Selected fulfilment is unavailable.")
    lines = []
    subtotal = Decimal("0")
    for line in data.items:
        item = scoped(db, m.MenuItem, line.menu_item_id, restaurant.id)
        category = scoped(db, m.Category, item.category_id, restaurant.id)
        if not item.available or not item.published or not category.published:
            fail(409, "An item is unavailable. Update your cart.", "menu_unavailable")
        variants = {x["id"]: x for x in item.variants}
        modifiers = {x["id"]: x for x in item.modifiers}
        if item.variant_required and not line.variant_id:
            fail(422, f"A variant is required for {item.name}.")
        if line.variant_id and line.variant_id not in variants:
            fail(422, "Variant does not belong to selected item.")
        if any(option not in modifiers for option in line.modifier_ids):
            fail(422, "Modifier does not belong to selected item.")
        variant = variants.get(line.variant_id)
        selected = [modifiers[key] for key in line.modifier_ids]
        unit = item.price + (Decimal(variant["price_delta"]) if variant else Decimal("0"))
        unit += sum((Decimal(x["price_delta"]) for x in selected), Decimal("0"))
        unit = unit.quantize(CENT, rounding=ROUND_HALF_UP)
        total = unit * line.quantity
        subtotal += total
        lines.append({"menu_item_id": item.id, "name": item.name, "quantity": line.quantity,
                      "variant_name": variant["name"] if variant else None,
                      "modifier_names": [x["name"] for x in selected],
                      "unit_price": money(unit), "line_total": money(total), "notes": line.notes})
    if subtotal < restaurant.minimum_order:
        fail(422, f"Minimum order is PKR {money(restaurant.minimum_order)}.")
    fee = restaurant.delivery_fee if data.fulfilment == "delivery" else Decimal("0")
    rate = restaurant.tax_rate / Decimal("100")
    tax = ((subtotal - subtotal / (1 + rate)) if restaurant.tax_inclusive else subtotal * rate)
    tax = tax.quantize(CENT, rounding=ROUND_HALF_UP)
    total = subtotal + fee + (Decimal("0") if restaurant.tax_inclusive else tax)
    if total > Decimal("9999999999.99"):
        fail(422, "Order total exceeds the supported monetary limit.")
    return {"items": lines, "subtotal": money(subtotal), "delivery_fee": money(fee),
            "tax": money(tax), "total": money(total), "currency": restaurant.currency}


def quote_binding(restaurant, data, quote):
    return digest(canonical({"restaurant_id": restaurant.id,
                             "fulfilment": data.fulfilment,
                             "cart": [item.model_dump(mode="json") for item in data.items],
                             "quote": quote,
                             "tax_rate": money(restaurant.tax_rate),
                             "tax_inclusive": restaurant.tax_inclusive}))


def normalize_options(values):
    output = []
    seen = set()
    for value in values:
        option = value.model_dump(mode="json") if hasattr(value, "model_dump") else dict(value)
        option["id"] = option.get("id") or m.uid()
        if option["id"] in seen:
            fail(422, "Option IDs must be unique within the item.")
        seen.add(option["id"])
        option["price_delta"] = money(option["price_delta"])
        output.append(option)
    return output


def apply_patch(obj, data):
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is None:
            fail(422, f"{key} cannot be null.")
        if key in {"variants", "modifiers"}:
            value = normalize_options(value)
        if key == "website_settings":
            value = data.website_settings.model_dump(mode="json")
        setattr(obj, key, value)


def require_reservations(restaurant):
    if not WebsiteSettings.model_validate(restaurant.website_settings or {}).reservations_enabled:
        fail(409, "New reservations are disabled for this restaurant.", "service_disabled")


def queue_email(db, restaurant, kind, recipient, subject, body):
    if recipient:
        db.add(m.Outbox(restaurant_id=restaurant.id, kind=kind, recipient=str(recipient),
                        subject=subject[:250], body=body))


def queue_status_email(db, restaurant, record, kind):
    payment = (f" Payment status: {record.payment_status}."
               if isinstance(record, m.Order) else "")
    receipt = (f" Cash receipt recorded: {record.currency} {money(record.total)}."
               if kind == "cash_receipt" else "")
    queue_email(db, restaurant, kind, record.email,
                f"{restaurant.name}: {record.reference} update",
                f"Reference: {record.reference}. Status: {record.status}.{payment}{receipt}")


def enforce_cap(db, restaurant, adding=0):
    plan = db.get(m.Plan, restaurant.plan_id) if restaurant.plan_id else None
    cap = plan.max_menu_items if plan else 30
    count = db.scalar(select(func.count()).select_from(m.MenuItem).where(
        m.MenuItem.restaurant_id == restaurant.id))
    if count + adding > cap:
        fail(409, "Menu item limit reached for this plan; edit an existing item or request a plan upgrade.")


def publish_check(db, restaurant):
    if restaurant.is_demo:
        fail(422, "Private development restaurants cannot be published.")
    if not all((restaurant.name, restaurant.address, restaurant.city,
                restaurant.phone, restaurant.email)):
        fail(422, "Publishing requires name, address, city, phone and email.")
    if not (restaurant.allow_pickup or restaurant.allow_delivery):
        fail(422, "Enable at least one fulfilment method.")
    if all(day["closed"] for day in restaurant.opening_hours.values()):
        fail(422, "Set at least one opening day.")
    count = db.scalar(select(func.count()).select_from(m.MenuItem).join(
        m.Category, m.MenuItem.category_id == m.Category.id).where(
            m.MenuItem.restaurant_id == restaurant.id, m.MenuItem.published.is_(True),
            m.MenuItem.available.is_(True), m.Category.published.is_(True)))
    if not count:
        fail(422, "Publish at least one available menu item in a published category.")
    enforce_cap(db, restaurant)


def reservation_window(restaurant, starts, party_size):
    starts = utc(starts)
    local = starts.astimezone(ZoneInfo(restaurant.timezone))
    today = m.now().astimezone(ZoneInfo(restaurant.timezone)).date()
    if starts <= m.now():
        fail(422, "Reservations must be in the future.")
    if local.date() > today + timedelta(days=restaurant.reservation_days_ahead):
        fail(422, "Reservation exceeds the advance booking window.")
    if not 1 <= party_size <= 30:
        fail(422, "Party size must be between 1 and 30.")
    ends = starts + timedelta(minutes=restaurant.reservation_duration_minutes)
    check_open(restaurant, starts, ends)
    return starts, ends


def choose_table(db, restaurant, starts, ends, party_size):
    buffer = timedelta(minutes=restaurant.reservation_buffer_minutes)
    tables = db.scalars(select(m.DiningTable).where(
        m.DiningTable.restaurant_id == restaurant.id, m.DiningTable.active.is_(True),
        m.DiningTable.capacity >= party_size).order_by(m.DiningTable.capacity, m.DiningTable.id))
    for table in tables:
        occupied = db.scalar(select(m.Reservation.id).where(
            m.Reservation.restaurant_id == restaurant.id,
            m.Reservation.table_id == table.id, m.Reservation.status.in_(HOLDING),
            m.Reservation.starts_at < ends + buffer,
            m.Reservation.ends_at > starts - buffer).limit(1))
        if not occupied:
            return table
    return None


def audit(db, user, kind, restaurant_id=None, reason="", details=None):
    db.add(m.Audit(actor_id=user.id, restaurant_id=restaurant_id, kind=kind,
                   reason=reason, details=details or {}))


def reference(prefix):
    return prefix + "-" + secrets.token_hex(5).upper()


def page(db, query, page_number, page_size, view=serialize):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = db.scalars(query.offset((page_number - 1) * page_size).limit(page_size))
    return {"items": [view(item) for item in items], "total": total,
            "page": page_number, "page_size": page_size}
