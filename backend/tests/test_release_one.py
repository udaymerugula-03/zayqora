import io
from datetime import timedelta
from decimal import Decimal
from urllib.parse import parse_qs, urlparse

from PIL import Image
from sqlalchemy import func, select

from app import models as m
from app.security import digest
from conftest import booking_payload, cart, create_order, login, order_payload

BASE = "/api/v1"
PUBLIC = BASE + "/public/restaurants/saffron-table"


def test_auth_revocation_and_hashed_sessions(api):
    client, factory, password = api
    auth = login(client, password)
    assert client.get(BASE + "/auth/me", headers=auth).json()["role"] == "owner"
    with factory() as db:
        session = db.scalar(select(m.Session))
        assert session.token_hash == digest(auth["Authorization"].split()[1])
        assert len(session.token_hash) == 64
    assert client.post(BASE + "/auth/logout", headers=auth).status_code == 200
    assert client.get(BASE + "/auth/me", headers=auth).status_code == 401
    assert client.post(BASE + "/auth/login", json={
        "email": "owner0@example.com", "password": "wrong"}).status_code == 401


def test_registration_pending_real_verification(api):
    client, factory, password = api
    response = client.post(BASE + "/auth/register", json={
        "full_name": "New Owner", "email": "new@example.com",
        "password": password, "restaurant_name": "New Restaurant", "slug": "new-place"})
    assert response.status_code == 201
    assert response.json()["email_delivery_status"] == "provider_not_configured"
    assert "token" not in response.json()
    assert client.post(BASE + "/auth/login", json={
        "email": "new@example.com", "password": password}).status_code == 403
    with factory() as db:
        owner = db.scalar(select(m.User).where(m.User.email == "new@example.com"))
        restaurant = db.get(m.Restaurant, owner.restaurant_id)
        assert not restaurant.published and not owner.email_verified
        outbox = db.scalar(select(m.Outbox).where(m.Outbox.kind == "verification"))
        link = outbox.body.splitlines()[1]
        token = parse_qs(urlparse(link).query)["token"][0]
        verification = db.get(m.Verification, digest(token))
        assert verification and verification.token_hash != token
    assert client.post(BASE + "/auth/verify-email", json={"token": token}).status_code == 200
    assert client.post(BASE + "/auth/verify-email", json={"token": token}).status_code == 400
    assert client.post(BASE + "/auth/login", json={
        "email": "new@example.com", "password": password}).status_code == 200


def test_tenant_isolation_and_admin_no_order_access(api):
    client, factory, password = api
    auth = login(client, password)
    other_auth = login(client, password, "owner1@example.com")
    admin = login(client, password, "admin@example.com")
    selection, other_item = cart(client, "other-tenant")
    assert client.patch(BASE + "/menu/items/" + other_item["id"], headers=auth,
                        json={"price": "1.00"}).status_code == 404
    other_category = other_item["category_id"]
    _, item = cart(client)
    assert client.patch(BASE + "/menu/items/" + item["id"], headers=auth,
                        json={"category_id": other_category}).status_code == 404
    assert client.post(PUBLIC + "/quote", json=selection).status_code == 404
    order = create_order(client).json()
    assert client.get(BASE + "/orders/" + order["id"], headers=other_auth).status_code == 404
    assert client.get(BASE + "/orders", headers=admin).status_code == 403
    assert client.get(BASE + "/platform/overview", headers=auth).status_code == 403


def test_suspend_hides_public_and_blocks_existing_sessions(api):
    client, factory, password = api
    auth = login(client, password)
    admin = login(client, password, "admin@example.com")
    tenant = client.get(BASE + "/restaurant", headers=auth).json()
    payload = order_payload(client)
    assert client.patch(BASE + f"/platform/tenants/{tenant['id']}/status", headers=admin,
                        json={"status": "suspended", "reason": "Demonstration suspension"}).status_code == 200
    assert client.get(PUBLIC).status_code == 404
    assert client.post(PUBLIC + "/orders", headers={"Idempotency-Key": "suspend-key"},
                       json=payload).status_code == 404
    assert client.post(PUBLIC + "/reservations", json=booking_payload()).status_code == 404
    assert client.get(BASE + "/restaurant", headers=auth).status_code == 403
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(m.Audit).where(
            m.Audit.kind == "platform.tenant_status")) == 1


def test_publish_checklist_and_menu_plan_cap(api):
    client, factory, password = api
    auth = login(client, password)
    assert client.patch(BASE + "/restaurant", headers=auth, json={
        "published": False}).status_code == 200
    assert client.get(PUBLIC).status_code == 404
    assert client.patch(BASE + "/restaurant", headers=auth, json={
        "address": "", "published": True}).status_code == 422
    assert client.patch(BASE + "/restaurant", headers=auth, json={
        "address": "Valid demonstration address", "published": True}).status_code == 200
    category = client.post(BASE + "/menu/categories", headers=auth,
                           json={"name": "Dessert", "published": True}).json()
    with factory() as db:
        plan = db.scalar(select(m.Plan))
        plan.max_menu_items = 1
        db.commit()
    assert client.post(BASE + "/menu/items", headers=auth, json={
        "category_id": category["id"], "name": "Cake", "price": "300.00"}).status_code == 409
    assert client.patch(BASE + "/restaurant", headers=auth,
                        json={"status": "active"}).status_code == 422


def test_variant_modifier_tampering_and_authoritative_decimal_quote(api):
    client, factory, password = api
    selection, item = cart(client)
    line = selection["items"][0]
    line["variant_id"] = "large1"
    assert client.post(PUBLIC + "/quote", json=selection).status_code == 422
    line["variant_id"] = "large0"
    line["modifier_ids"] = ["sauce1"]
    assert client.post(PUBLIC + "/quote", json=selection).status_code == 422
    line["modifier_ids"] = ["sauce0", "sauce0"]
    assert client.post(PUBLIC + "/quote", json=selection).status_code == 422
    line["modifier_ids"] = ["sauce0"]
    quote = client.post(PUBLIC + "/quote", json=selection).json()
    assert quote["total"] == "1300.00"
    assert quote["items"][0]["unit_price"] == "650.00"
    line["price"] = "0.01"
    assert client.post(PUBLIC + "/quote", json=selection).status_code == 422


def test_signed_quote_drift_expiry_and_cart_binding(api):
    client, factory, password = api
    auth = login(client, password)
    payload = order_payload(client)
    item_id = payload["items"][0]["menu_item_id"]
    assert client.patch(BASE + "/menu/items/" + item_id, headers=auth,
                        json={"price": "600.00"}).status_code == 200
    response = create_order(client, payload)
    assert response.status_code == 409 and response.json()["code"] == "quote_changed"
    payload = order_payload(client)
    payload["items"][0]["quantity"] = 3
    assert create_order(client, payload).status_code == 409
    payload = order_payload(client)
    payload["quote_token"] += "tamper"
    assert create_order(client, payload).status_code == 409
    payload = order_payload(client)
    client.app.state.config.quote_minutes = -1
    payload["quote_token"] = client.post(PUBLIC + "/quote", json={
        "items": payload["items"], "fulfilment": "pickup"}).json()["quote_token"]
    assert create_order(client, payload).json()["code"] == "quote_expired"


def test_idempotency_original_tracking_and_snapshot(api):
    client, factory, password = api
    auth = login(client, password)
    payload = order_payload(client)
    first = create_order(client, payload)
    assert first.status_code == 201, first.text
    second = create_order(client, payload)
    assert second.json() == first.json()
    assert first.json()["payment_status"] == "unpaid"
    changed = {**payload, "phone": "03009999999"}
    assert create_order(client, changed).status_code == 409
    order = first.json()
    tracked = client.get(BASE + "/public/orders/" + order["tracking_token"]).json()
    for key in ("customer_name", "email", "phone", "address", "notes", "tracking_token"):
        assert key not in tracked
    assert tracked["items"][0]["notes"] == ""
    item = payload["items"][0]["menu_item_id"]
    client.patch(BASE + "/menu/items/" + item, headers=auth,
                 json={"name": "Renamed", "price": "700.00", "published": False})
    detail = client.get(BASE + "/orders/" + order["id"], headers=auth).json()
    assert detail["items"][0]["name"] == "Biryani"
    assert detail["total"] == "1000.00"
    assert create_order(client, payload).json() == first.json()
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(m.Order)) == 1


def test_cash_transitions_duplicate_receipt_and_reports(api):
    client, factory, password = api
    auth = login(client, password)
    order = create_order(client).json()
    path = BASE + "/orders/" + order["id"]
    assert client.patch(path + "/status", headers=auth, json={"status": "COMPLETED"}).status_code == 409
    for status in ("CONFIRMED", "PREPARING", "READY"):
        response = client.patch(path + "/status", headers=auth, json={"status": status})
        assert response.status_code == 200, response.text
    assert client.patch(path + "/status", headers=auth,
                        json={"status": "OUT_FOR_DELIVERY"}).status_code == 409
    assert client.patch(path + "/status", headers=auth, json={"status": "COMPLETED"}).status_code == 409
    assert client.get(BASE + "/reports/dashboard", headers=auth).json()["gross_sales"] == "0.00"
    first = client.post(path + "/cash-payment", headers=auth)
    assert first.status_code == 200
    assert client.post(path + "/cash-payment", headers=auth).json() == first.json()
    assert client.patch(path + "/status", headers=auth, json={"status": "CANCELLED"}).status_code == 409
    assert client.patch(path + "/status", headers=auth, json={"status": "COMPLETED"}).status_code == 200
    report = client.get(BASE + "/reports/dashboard", headers=auth).json()
    assert report["gross_sales"] == "1000.00" and report["top_items"][0]["quantity"] == 2
    assert client.patch(path + "/status", headers=auth, json={"status": "READY"}).status_code == 409
    with factory() as db:
        receipts = db.scalar(select(func.count()).select_from(m.Audit).where(m.Audit.kind == "order.cash_received"))
        assert receipts == 1


def test_delivery_requires_dispatch_and_cancelled_cash_rejected(api):
    client, factory, password = api
    auth = login(client, password)
    payload = order_payload(client)
    payload["fulfilment"] = "delivery"
    payload["address"] = "123 Demo Road Karachi"
    payload["quote_token"] = client.post(PUBLIC + "/quote", json={
        "items": payload["items"], "fulfilment": "delivery"}).json()["quote_token"]
    response = create_order(client, payload)
    assert response.status_code == 201, response.text
    path = BASE + "/orders/" + response.json()["id"]
    assert response.json()["total"] == "1100.00"
    for status in ("CONFIRMED", "PREPARING", "READY"):
        assert client.patch(path + "/status", headers=auth, json={"status": status}).status_code == 200
    client.post(path + "/cash-payment", headers=auth)
    assert client.patch(path + "/status", headers=auth, json={"status": "COMPLETED"}).status_code == 409
    assert client.patch(path + "/status", headers=auth, json={"status": "OUT_FOR_DELIVERY"}).status_code == 200
    assert client.patch(path + "/status", headers=auth, json={"status": "COMPLETED"}).status_code == 200
    another = create_order(client, key="another-key").json()
    another_path = BASE + "/orders/" + another["id"]
    assert client.patch(another_path + "/status", headers=auth,
                        json={"status": "REJECTED"}).status_code == 200
    assert client.post(another_path + "/cash-payment", headers=auth).status_code == 409


def test_reservations_overlap_buffer_bounds_and_transitions(api):
    client, factory, password = api
    auth = login(client, password)
    payload = booking_payload()
    first = client.post(PUBLIC + "/reservations", json=payload)
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "REQUESTED"
    assert client.post(PUBLIC + "/reservations", json=payload).status_code == 409
    from datetime import datetime
    start = datetime.fromisoformat(payload["starts_at"])
    payload["starts_at"] = (start + timedelta(minutes=100)).isoformat()
    assert client.post(PUBLIC + "/reservations", json=payload).status_code == 409
    payload["starts_at"] = (start + timedelta(minutes=105)).isoformat()
    assert client.post(PUBLIC + "/reservations", json=payload).status_code == 201
    payload["starts_at"] = (m.now() - timedelta(hours=1)).isoformat()
    assert client.post(PUBLIC + "/reservations", json=payload).status_code == 422
    payload["starts_at"] = (m.now() + timedelta(days=100)).isoformat()
    assert client.post(PUBLIC + "/reservations", json=payload).status_code == 422
    path = BASE + "/reservations/" + first.json()["id"] + "/status"
    assert client.patch(path, headers=auth, json={"status": "SEATED"}).status_code == 409
    for status in ("CONFIRMED", "SEATED", "COMPLETED"):
        assert client.patch(path, headers=auth, json={"status": status}).status_code == 200


def test_opening_hours_and_closed_public_quote(api):
    client, factory, password = api
    auth = login(client, password)
    selection, item = cart(client)
    hours = m.hours()
    for day in hours.values():
        day["closed"] = True
    # Unpublish while closing every day; published setup must remain sensible.
    assert client.patch(BASE + "/restaurant", headers=auth, json={
        "opening_hours": hours, "published": False}).status_code == 200
    assert client.patch(BASE + "/restaurant", headers=auth, json={"published": True}).status_code == 422
    with factory() as db:
        restaurant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        restaurant.published = True
        db.commit()
    assert client.post(PUBLIC + "/quote", json=selection).status_code == 409


def test_media_content_size_and_production_fail_closed(api):
    client, factory, password = api
    auth = login(client, password)
    assert client.post(BASE + "/media", headers=auth, files={
        "file": ("bad.jpg", b"not an image", "image/jpeg")}).status_code == 422
    assert client.post(BASE + "/media", headers=auth, files={
        "file": ("large.jpg", b"x" * (4 * 1024 * 1024 + 1), "image/jpeg")}).status_code == 413
    image = io.BytesIO()
    Image.new("RGB", (10, 10), "green").save(image, "PNG")
    response = client.post(BASE + "/media", headers=auth, files={
        "file": ("../../unsafe.png", image.getvalue(), "image/png")})
    assert response.status_code == 201
    path = response.json()["url"]
    assert path.startswith("/media/") and path.endswith(".jpg")
    assert client.get(path).status_code == 200
    from app.config import ROOT
    (ROOT / ".uploads" / path.split("/")[-1]).unlink()
    client.app.state.config.app_env = "production"
    assert client.post(BASE + "/media", headers=auth, files={
        "file": ("safe.png", image.getvalue(), "image/png")}).status_code == 503


def test_rate_limit_and_runtime_reject_weak_config(api):
    client, factory, password = api
    for _ in range(10):
        response = client.post(BASE + "/auth/login", json={
            "email": "absent@example.com", "password": "incorrect"})
        assert response.status_code == 401
    assert client.post(BASE + "/auth/login", json={
        "email": "absent@example.com", "password": "incorrect"}).status_code == 429
    import pytest
    from app.config import Settings
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        Settings(_env_file=None, database_url="sqlite://", secret_key="x" * 40).validate_runtime()
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        Settings(_env_file=None, database_url="postgresql://localhost/x", secret_key="weak").validate_runtime()
