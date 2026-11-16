import smtplib
from datetime import timedelta
from decimal import Decimal
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select

from app import models as m
from app import public
from app.security import digest, fail
from app.worker import deliver_batch
from conftest import cart, create_order, login, order_payload

BASE = "/api/v1"
PUBLIC = BASE + "/public/restaurants/saffron-table"


def test_expired_sessions_and_verification_resend(api):
    client, factory, password = api
    auth = login(client, password)
    with factory() as db:
        session = db.get(m.Session, digest(auth["Authorization"].split()[1]))
        session.expires_at = m.now() - timedelta(seconds=1)
        db.commit()
    assert client.get(BASE + "/auth/me", headers=auth).status_code == 401
    client.post(BASE + "/auth/register", json={
        "full_name": "Pending Owner", "email": "pending@example.com",
        "password": password, "restaurant_name": "Pending Restaurant", "slug": "pending-place"})
    with factory() as db:
        original = db.scalar(select(m.Outbox).where(m.Outbox.kind == "verification"))
        old_token = parse_qs(urlparse(original.body.splitlines()[1]).query)["token"][0]
        verification = db.get(m.Verification, digest(old_token))
        verification.expires_at = m.now() - timedelta(seconds=1)
        db.commit()
    assert client.post(BASE + "/auth/verify-email", json={"token": old_token}).status_code == 400
    response = client.post(BASE + "/auth/resend-verification", json={"email": "pending@example.com"})
    assert response.status_code == 200 and "token" not in response.json()
    with factory() as db:
        original = db.scalar(select(m.Outbox).where(m.Outbox.status == "cancelled"))
        assert original.body == "[superseded]"
        queued = db.scalar(select(m.Outbox).where(m.Outbox.status == "pending"))
        token = parse_qs(urlparse(queued.body.splitlines()[1]).query)["token"][0]
    assert client.post(BASE + "/auth/verify-email", json={"token": old_token}).status_code == 400
    assert client.post(BASE + "/auth/verify-email", json={"token": token}).status_code == 200


def test_tax_rounding_and_only_paid_completed_metrics(api):
    client, factory, password = api
    auth = login(client, password)
    selection, item = cart(client)
    client.patch(BASE + "/menu/items/" + item["id"], headers=auth, json={"price": "99.99"})
    client.patch(BASE + "/restaurant", headers=auth, json={"tax_rate": "16.00", "tax_inclusive": False})
    quote = client.post(PUBLIC + "/quote", json=selection).json()
    assert (quote["subtotal"], quote["tax"], quote["total"]) == ("199.98", "32.00", "231.98")
    client.patch(BASE + "/restaurant", headers=auth, json={"tax_inclusive": True})
    quote = client.post(PUBLIC + "/quote", json=selection).json()
    assert (quote["tax"], quote["total"]) == ("27.58", "199.98")
    first = create_order(client, key="eligible-key").json()
    second = create_order(client, key="ineligible-key").json()
    with factory() as db:
        eligible = db.get(m.Order, first["id"])
        eligible.status = "COMPLETED"
        eligible.payment_status = "paid"
        ineligible = db.get(m.Order, second["id"])
        ineligible.payment_status = "paid"
        other = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "other-tenant"))
        # A non-completed paid order and another tenant must never inflate this report.
        db.commit()
    report = client.get(BASE + "/reports/dashboard", headers=auth).json()
    assert report["gross_sales"] == "199.98"
    assert report["net_sales"] == "172.40"
    assert report["average_order_value"] == "199.98"
    assert report["top_items"][0]["quantity"] == 2
    assert report["top_items"][0]["revenue"] == "172.40"
    client.patch(BASE + "/restaurant", headers=auth,
                 json={"tax_rate": "0.00", "tax_inclusive": False})
    historical = client.get(BASE + "/reports/dashboard", headers=auth).json()
    assert historical["top_items"][0]["revenue"] == "172.40"
    other_auth = login(client, password, "owner1@example.com")
    assert client.get(BASE + "/reports/dashboard", headers=other_auth).json()["gross_sales"] == "0.00"


def test_committed_order_replays_before_throttling_or_publication_checks(api, monkeypatch):
    client, factory, password = api
    payload = order_payload(client)
    original = create_order(client, payload, key="recovery-key")
    assert original.status_code == 201

    def throttled(request, scope, limit):
        if scope == "checkout":
            fail(429, "Too many checkout attempts.")

    monkeypatch.setattr(public, "rate", throttled)
    replay = create_order(client, payload, key="recovery-key")
    assert replay.status_code == 201 and replay.json() == original.json()
    assert create_order(client, payload, key="new-throttled-key").status_code == 429
    with factory() as db:
        tenant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        tenant.published = False
        tenant.status = "suspended"
        db.commit()
    replay = create_order(client, payload, key="recovery-key")
    assert replay.status_code == 201 and replay.json() == original.json()


def test_item_revenue_allocates_included_tax_without_losing_rounding_pennies(api):
    client, factory, password = api
    order_id = create_order(client).json()["id"]
    with factory() as db:
        order = db.get(m.Order, order_id)
        order.status, order.payment_status = "COMPLETED", "paid"
        order.subtotal, order.tax = Decimal("0.03"), Decimal("0.01")
        order.delivery_fee, order.total = Decimal("0.10"), Decimal("0.13")
        order.items = [
            {"menu_item_id": key, "name": key, "quantity": 1,
             "unit_price": "0.01", "line_total": "0.01",
             "variant_name": None, "modifier_names": [], "notes": ""}
            for key in ("first", "second", "third")
        ]
        db.commit()
    report = client.get(BASE + "/reports/dashboard", headers=login(client, password)).json()
    revenues = [Decimal(item["revenue"]) for item in report["top_items"]]
    assert sum(revenues) == Decimal("0.02")
    assert all(value >= 0 for value in revenues)
    assert report["net_sales"] == "0.12"


def test_smtp_worker_marks_sent_only_on_real_provider_acceptance(api, monkeypatch):
    client, factory, password = api
    create_order(client)
    config = client.app.state.config
    config.smtp_host = "smtp.example.com"
    config.smtp_from = "noreply@example.com"
    sent_messages = []

    class AcceptedSMTP:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def starttls(self, **kwargs):
            pass

        def send_message(self, message):
            sent_messages.append(message)

    monkeypatch.setattr(smtplib, "SMTP", AcceptedSMTP)
    assert deliver_batch(factory, config) == 1
    assert len(sent_messages) == 1
    with factory() as db:
        outbox = db.scalar(select(m.Outbox))
        assert outbox.status == "sent" and outbox.body == "[delivered]"
    create_order(client, key="mail-failure-key")

    class RejectedSMTP(AcceptedSMTP):
        def send_message(self, message):
            raise smtplib.SMTPException("test provider rejection")

    monkeypatch.setattr(smtplib, "SMTP", RejectedSMTP)
    assert deliver_batch(factory, config) == 0
    with factory() as db:
        pending = db.scalar(select(m.Outbox).where(m.Outbox.status == "pending"))
        assert pending.attempts == 1
        assert pending.body != "[delivered]"


def test_platform_plan_assignment_requires_reason_and_audits(api):
    client, factory, password = api
    auth = login(client, password)
    admin = login(client, password, "admin@example.com")
    tenant = client.get(BASE + "/restaurant", headers=auth).json()
    created = client.post(BASE + "/platform/plans", headers=admin, json={
        "name": "Expanded", "description": "Larger demonstration plan",
        "max_menu_items": 40, "active": True})
    assert created.status_code == 201
    plan = created.json()
    path = BASE + "/platform/tenants/" + tenant["id"] + "/plan"
    assert client.patch(path, headers=admin, json={"plan_id": plan["id"]}).status_code == 422
    assert client.patch(path, headers=admin, json={
        "plan_id": plan["id"], "reason": "Owner requested expansion"}).status_code == 200
    assert client.get(BASE + "/restaurant", headers=auth).json()["plan_id"] == plan["id"]
    with factory() as db:
        event = db.scalar(select(m.Audit).where(m.Audit.kind == "platform.tenant_plan"))
        assert event.reason == "Owner requested expansion"
