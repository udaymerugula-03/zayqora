from datetime import datetime, timezone

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app import models as m
from app.schemas import WebsiteSettings
from app.services import queue_email
from conftest import booking_payload, create_order, login, order_payload

BASE = "/api/v1"
PUBLIC = BASE + "/public/restaurants/saffron-table"


@pytest.mark.parametrize("value", [
    {"theme": "red"}, {"typography": "script"}, {"about_text": "x" * 10001},
    {"seo_title": "x" * 161}, {"seo_description": "x" * 321},
    {"gallery": [{"image_url": "javascript:alert(1)", "alt": "Test"}]},
    {"gallery": [{"image_url": "/food/test.jpg", "alt": " "}]},
    {"gallery": [{"image_url": "/food/test.jpg", "alt": "Test"}] * 31},
    {"faqs": [{"question": "Question", "answer": ""}]},
    {"faqs": [{"question": "Question", "answer": "Answer"}] * 31},
    {"homepage_sections": ["about", "about"]}, {"homepage_sections": ["menu"]},
    {"reservations_enabled": None}, {"unknown": True},
])
def test_website_settings_validation(value):
    with pytest.raises(ValidationError):
        WebsiteSettings.model_validate(value)


def test_settings_complete_defaults_and_replacement(api):
    client, factory, password = api
    auth = login(client, password)
    default = WebsiteSettings().model_dump()
    assert client.get(PUBLIC).json()["website_settings"] == default
    assert client.get(PUBLIC).json()["is_demo"] is False
    changed = client.patch(BASE + "/restaurant", headers=auth, json={
        "website_settings": {"theme": "emerald", "homepage_sections": [],
                             "gallery": [{"image_url": "https://example.com/image.jpg", "alt": "Photo"}]}})
    assert changed.status_code == 200, changed.text
    assert changed.json()["website_settings"]["homepage_sections"] == []
    replaced = client.patch(BASE + "/restaurant", headers=auth, json={"website_settings": {}})
    assert replaced.json()["website_settings"] == default
    for bad in ({"website_settings": None}, {"is_demo": True}):
        assert client.patch(BASE + "/restaurant", headers=auth, json=bad).status_code == 422
    with factory() as db:
        tenant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        tenant.website_settings = {"theme": "terracotta"}
        db.commit()
    assert client.get(PUBLIC).json()["website_settings"] == {**default, "theme": "terracotta"}


def test_disabled_new_reservations_preserve_holds_and_status(api):
    client, factory, password = api
    auth = login(client, password)
    payload = booking_payload()
    held = client.post(PUBLIC + "/reservations", json=payload).json()
    assert client.patch(BASE + "/restaurant", headers=auth, json={
        "website_settings": {"reservations_enabled": False}}).status_code == 200
    response = client.get(PUBLIC + "/availability", params={
        "date": payload["starts_at"][:10], "party_size": 4})
    assert response.status_code == 409 and response.json()["code"] == "service_disabled"
    response = client.post(PUBLIC + "/reservations", json=payload)
    assert response.status_code == 409 and response.json()["code"] == "service_disabled"
    assert client.patch(BASE + f"/reservations/{held['id']}/status", headers=auth,
                        json={"status": "CONFIRMED"}).status_code == 200
    assert client.get(PUBLIC + "/menu").status_code == 200
    with factory() as db:
        assert db.scalar(select(func.count()).select_from(m.Reservation)) == 1


def test_inquiry_persist_scope_status_and_public_privacy(api):
    client, factory, password = api
    payload = {"customer_name": " Guest ", "email": "guest@example.com", "subject": " Menu question ",
               "message": " Is there a vegan option? ", "consent": True}
    response = client.post(PUBLIC + "/inquiries", json=payload)
    assert response.status_code == 201, response.text
    result = response.json()
    assert set(result) == {"reference", "status", "notification_status"}
    assert result["status"] == "received" and result["reference"].startswith("ENQ-")
    assert result["notification_status"] == "provider_not_configured"
    auth = login(client, password)
    other = login(client, password, "owner1@example.com")
    listed = client.get(BASE + "/inquiries", headers=auth).json()
    assert listed["total"] == 1
    inquiry = listed["items"][0]
    assert inquiry["customer_name"] == "Guest" and inquiry["subject"] == "Menu question"
    assert client.get(BASE + "/inquiries", headers=other).json()["items"] == []
    path = BASE + "/inquiries/" + inquiry["id"]
    assert client.patch(path, headers=other, json={"status": "resolved"}).status_code == 404
    assert client.patch(path, headers=auth, json={"status": "read"}).json()["status"] == "read"
    assert client.patch(path, headers=auth, json={"status": "resolved"}).json()["status"] == "resolved"
    assert client.patch(path, headers=auth, json={"status": "deleted"}).status_code == 422
    with factory() as db:
        saved = db.get(m.ContactInquiry, inquiry["id"])
        assert saved.email == payload["email"] and saved.message == payload["message"].strip()
        notice = db.scalar(select(m.Outbox).where(m.Outbox.kind == "contact_inquiry"))
        assert notice.recipient == "owner0@example.com" and result["reference"] in notice.body
        assert db.scalar(select(func.count()).select_from(m.Audit).where(
            m.Audit.kind == "inquiry.status")) == 2
    for invalid in ({"consent": False}, {"message": "short"}, {"email": "invalid"},
                    {"customer_name": " "}, {"subject": " "},
                    {"subject": "Menu\nquestion"}, {"subject": "Menu\rquestion"}):
        assert client.post(PUBLIC + "/inquiries", json={**payload, **invalid}).status_code == 422
    client.patch(BASE + "/restaurant", headers=auth, json={"published": False})
    assert client.post(PUBLIC + "/inquiries", json=payload).status_code == 404


def outbox_count(factory):
    with factory() as db:
        return db.scalar(select(func.count()).select_from(m.Outbox))


def test_order_notification_transitions_duplicate_cash_and_rejections(api):
    client, factory, password = api
    auth = login(client, password)
    payload = order_payload(client)
    response = create_order(client, payload)
    order = response.json()
    assert outbox_count(factory) == 2
    assert create_order(client, payload).json() == order
    assert outbox_count(factory) == 2
    path = BASE + "/orders/" + order["id"]
    assert client.patch(path + "/status", headers=auth, json={"status": "READY"}).status_code == 409
    assert client.patch(path + "/status", headers=auth, json={"status": "REJECTED"}).status_code == 422
    assert outbox_count(factory) == 2
    assert client.patch(path + "/status", headers=auth, json={"status": "CONFIRMED"}).status_code == 200
    assert outbox_count(factory) == 3
    for _ in range(2):
        assert client.post(path + "/cash-payment", headers=auth).status_code == 200
    assert outbox_count(factory) == 4
    assert client.patch(path + "/status", headers=auth, json={
        "status": "CANCELLED", "reason": "Private rejection reason"}).status_code == 409
    assert outbox_count(factory) == 4
    rejected = create_order(client, key="rejected-cash-key").json()
    rejected_path = BASE + "/orders/" + rejected["id"]
    assert client.patch(rejected_path + "/status", headers=auth, json={
        "status": "REJECTED", "reason": "Private rejection reason"}).status_code == 200
    count = outbox_count(factory)
    assert client.post(rejected_path + "/cash-payment", headers=auth).status_code == 409
    assert outbox_count(factory) == count
    with factory() as db:
        messages = list(db.scalars(select(m.Outbox)))
        assert all("Private rejection reason" not in msg.body for msg in messages)
        assert all(order["tracking_token"] not in msg.body for msg in messages)
        receipt = next(msg for msg in messages if msg.kind == "cash_receipt")
        assert "1000.00" in receipt.body and "paid" in receipt.body


def test_reservation_notifications_no_customer_email_and_rollback(api):
    client, factory, password = api
    auth = login(client, password)
    payload = {**booking_payload(), "email": ""}
    booking = client.post(PUBLIC + "/reservations", json=payload).json()
    assert outbox_count(factory) == 1  # Owner notice is independent of customer email.
    path = BASE + "/reservations/" + booking["id"] + "/status"
    assert client.patch(path, headers=auth, json={"status": "CONFIRMED"}).status_code == 200
    assert outbox_count(factory) == 1
    assert client.post(PUBLIC + "/reservations", json=booking_payload()).status_code == 409
    assert outbox_count(factory) == 1
    with factory() as db:
        tenant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        queue_email(db, tenant, "rollback_test", tenant.email, "Rollback", "Never delivered.")
        db.flush()
        db.rollback()
    assert outbox_count(factory) == 1


def test_customer_reservation_status_and_no_email_order(api):
    client, factory, password = api
    auth = login(client, password)
    booking = client.post(PUBLIC + "/reservations", json=booking_payload()).json()
    assert outbox_count(factory) == 2
    path = BASE + "/reservations/" + booking["id"] + "/status"
    assert client.patch(path, headers=auth, json={
        "status": "DECLINED", "reason": "Private owner reason"}).status_code == 200
    assert outbox_count(factory) == 3
    with factory() as db:
        notice = db.scalar(select(m.Outbox).where(m.Outbox.kind == "reservation_status"))
        assert "DECLINED" in notice.body and booking["reference"] in notice.body
        assert "Private owner reason" not in notice.body
    payload = {**order_payload(client), "email": ""}
    order = create_order(client, payload).json()
    assert outbox_count(factory) == 4
    assert client.patch(BASE + f"/orders/{order['id']}/status", headers=auth,
                        json={"status": "CONFIRMED"}).status_code == 200
    assert client.post(BASE + f"/orders/{order['id']}/cash-payment", headers=auth).status_code == 200
    assert outbox_count(factory) == 4


@pytest.mark.parametrize("operation", ["status", "cash-payment", "inquiry"])
def test_notification_and_business_mutation_rollback_together(api, monkeypatch, operation):
    client, factory, password = api
    auth = login(client, password)
    order = create_order(client).json()
    before = outbox_count(factory)
    def failed_commit(self):
        self.flush()
        raise RuntimeError("Simulated transactional failure")
    with monkeypatch.context() as patch:
        patch.setattr(factory.class_, "commit", failed_commit)
        with pytest.raises(RuntimeError, match="Simulated transactional failure"):
            if operation == "inquiry":
                client.post(PUBLIC + "/inquiries", json={
                    "customer_name": "Guest", "email": "guest@example.com",
                    "subject": "Question", "message": "A valid contact question", "consent": True})
            elif operation == "status":
                client.patch(BASE + f"/orders/{order['id']}/status", headers=auth,
                             json={"status": "CONFIRMED"})
            else:
                client.post(BASE + f"/orders/{order['id']}/cash-payment", headers=auth)
    assert outbox_count(factory) == before
    with factory() as db:
        saved = db.get(m.Order, order["id"])
        assert saved.status == "PENDING" and saved.payment_status == "unpaid"
        assert db.scalar(select(func.count()).select_from(m.ContactInquiry)) == 0


def test_missing_owner_email_does_not_create_empty_recipient(api):
    client, factory, password = api
    with factory() as db:
        tenant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        tenant.email = ""
        db.commit()
    payload = {**order_payload(client), "email": ""}
    assert create_order(client, payload).status_code == 201
    assert outbox_count(factory) == 0
    assert client.post(PUBLIC + "/reservations", json={
        **booking_payload(), "email": ""}).status_code == 201
    assert outbox_count(factory) == 0


def test_order_filters_tenant_status_and_karachi_half_open_dates(api):
    client, factory, password = api
    auth = login(client, password)
    order = create_order(client).json()
    create_order(client, key="other-filter-order", slug="other-tenant")
    with factory() as db:
        saved = db.get(m.Order, order["id"])
        saved.created_at = datetime(2026, 6, 1, 19, 0, tzinfo=timezone.utc)  # June 2 Karachi.
        saved.payment_status = "paid"
        saved.status = "COMPLETED"
        db.commit()
    def filtered(**params):
        return client.get(BASE + "/orders", headers=auth, params=params)
    assert filtered(from_date="2026-06-02", to_date="2026-06-02",
                    fulfilment="pickup", payment_status="paid", status="COMPLETED").json()["total"] == 1
    for params in ({"to_date": "2026-06-01"}, {"from_date": "2026-06-03"},
                   {"active_only": "true"}, {"fulfilment": "delivery"},
                   {"payment_status": "unpaid"}, {"status": "PENDING"}):
        assert filtered(**params).json()["total"] == 0
    assert filtered(q=order["reference"], page_size=1).json()["total"] == 1
    for params in ({"fulfilment": "invalid"}, {"payment_status": "refunded"},
                   {"from_date": "2026-06-03", "to_date": "2026-06-01"},
                   {"from_date": "bad"}):
        assert filtered(**params).status_code == 422
