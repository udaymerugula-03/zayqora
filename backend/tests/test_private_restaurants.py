import pytest
from sqlalchemy import func, select

from app import models as m
from conftest import booking_payload, create_order, login, order_payload

BASE = "/api/v1"
PUBLIC = BASE + "/public/restaurants/saffron-table"


def make_sample(factory):
    with factory() as db:
        restaurant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        restaurant.is_demo = True
        restaurant.tagline = "Sample restaurant"
        db.commit()


def counts(factory):
    with factory() as db:
        return tuple(db.scalar(select(func.count()).select_from(model))
                     for model in (m.Order, m.Reservation, m.ContactInquiry, m.Outbox))


def test_sample_restaurant_public_marker_and_guest_workflows(api):
    client, factory, password = api
    make_sample(factory)
    listed = client.get(BASE + "/public/restaurants", params={"page_size": 1}).json()
    assert listed["total"] == 2
    assert listed["items"][0]["slug"] == "saffron-table"
    assert listed["items"][0]["is_demo"] is True
    assert listed["items"][0]["tagline"] == "Sample restaurant"
    detail = client.get(PUBLIC)
    assert detail.status_code == 200
    assert detail.json()["is_demo"] is True
    assert detail.json()["tagline"] == "Sample restaurant"
    assert client.get(PUBLIC + "/menu").status_code == 200
    payload = order_payload(client)
    original = create_order(client, payload, key="sample-replay-key")
    assert original.status_code == 201, original.text
    order = original.json()
    assert order["is_demo"] is True
    before = counts(factory)
    assert create_order(client, payload, key="sample-replay-key").json() == order
    assert counts(factory) == before
    assert create_order(client, {**payload, "notes": "changed"},
                        key="sample-replay-key").status_code == 409
    tracked = client.get(BASE + "/public/orders/" + order["tracking_token"])
    assert tracked.status_code == 200
    assert tracked.json()["reference"] == order["reference"]
    assert tracked.json()["is_demo"] is True
    assert not {"email", "phone", "customer_name", "notes"} & tracked.json().keys()
    assert client.post(BASE + "/public/restaurants/other-tenant/quote", json={
        "items": payload["items"], "fulfilment": payload["fulfilment"]}).status_code == 404
    assert create_order(client, payload, key="sample-replay-key",
                        slug="other-tenant").status_code == 404
    booking = booking_payload()
    available = client.get(PUBLIC + "/availability", params={
        "date": booking["starts_at"][:10], "party_size": 4})
    assert available.status_code == 200 and available.json()["slots"]
    reservation = client.post(PUBLIC + "/reservations", json=booking)
    assert reservation.status_code == 201, reservation.text
    inquiry = client.post(PUBLIC + "/inquiries", json={
        "customer_name": "Guest", "email": "guest@example.com", "subject": "Question",
        "message": "A valid contact question.", "consent": True})
    assert inquiry.status_code == 201, inquiry.text
    assert counts(factory) == (1, 1, 1, 5)

    auth = login(client, password)
    assert client.get(BASE + "/restaurant", headers=auth).json()["is_demo"] is True
    assert client.get(BASE + "/orders/" + order["id"], headers=auth).status_code == 200
    assert client.get(BASE + "/orders/" + order["id"], headers=auth).json()["is_demo"] is True
    assert client.get(BASE + "/orders", headers=auth).json()["items"][0]["is_demo"] is True
    other = login(client, password, "owner1@example.com")
    assert client.get(BASE + "/orders/" + order["id"], headers=other).status_code == 404
    assert client.get(BASE + "/reservations", headers=other).json()["items"] == []
    assert client.get(BASE + "/inquiries", headers=other).json()["items"] == []
    admin = login(client, password, "admin@example.com")
    tenants = client.get(BASE + "/platform/tenants", headers=admin).json()
    assert any(tenant["is_demo"] for tenant in tenants["items"])
    overview = client.get(BASE + "/platform/overview", headers=admin).json()
    assert overview["total_tenants"] == 2 and overview["published_restaurants"] == 2


@pytest.mark.parametrize("is_demo", [False, True])
@pytest.mark.parametrize("gate", ["unpublished", "suspended"])
def test_publication_and_active_gates_preserve_order_recovery(api, is_demo, gate):
    client, factory, password = api
    if is_demo:
        make_sample(factory)
    payload = order_payload(client)
    original = create_order(client, payload, key="gated-replay-key")
    assert original.status_code == 201
    order = original.json()
    assert order["is_demo"] is is_demo
    with factory() as db:
        restaurant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        if gate == "unpublished":
            restaurant.published = False
        else:
            restaurant.status = "suspended"
        db.commit()
    before = counts(factory)
    booking = booking_payload()
    listed = client.get(BASE + "/public/restaurants", params={"page_size": 1}).json()
    assert listed["total"] == 1
    assert [tenant["slug"] for tenant in listed["items"]] == ["other-tenant"]
    for path in (PUBLIC, PUBLIC + "/menu"):
        assert client.get(path).status_code == 404
    assert client.get(PUBLIC + "/availability", params={
        "date": booking["starts_at"][:10], "party_size": 4}).status_code == 404
    assert client.post(PUBLIC + "/quote", json={
        "items": payload["items"], "fulfilment": payload["fulfilment"]}).status_code == 404
    assert create_order(client, payload, key="gated-new-key").status_code == 404
    assert client.post(PUBLIC + "/reservations", json=booking).status_code == 404
    assert client.post(PUBLIC + "/inquiries", json={
        "customer_name": "Guest", "email": "guest@example.com", "subject": "Question",
        "message": "A valid contact question.", "consent": True}).status_code == 404
    tracked = client.get(BASE + "/public/orders/" + order["tracking_token"])
    assert tracked.status_code == 200
    assert tracked.json()["reference"] == order["reference"]
    assert tracked.json()["is_demo"] is is_demo
    replay = create_order(client, payload, key="gated-replay-key")
    assert replay.status_code == 201 and replay.json() == order
    assert counts(factory) == before

    admin = login(client, password, "admin@example.com")
    overview = client.get(BASE + "/platform/overview", headers=admin).json()
    assert overview["total_tenants"] == 2 and overview["published_restaurants"] == 1


def test_sample_owner_publishing_uses_normal_validation_and_marker_is_read_only(api):
    client, factory, password = api
    make_sample(factory)
    auth = login(client, password)
    changed = client.patch(BASE + "/restaurant", headers=auth, json={
        "tagline": "Sample restaurant", "website_settings": {"theme": "emerald"}})
    assert changed.status_code == 200, changed.text
    assert changed.json()["is_demo"] is True
    for published in (True, False, True):
        response = client.patch(BASE + "/restaurant", headers=auth, json={"published": published})
        assert response.status_code == 200, response.text
        assert response.json()["is_demo"] is True
    for marker in (False, True, None):
        assert client.patch(BASE + "/restaurant", headers=auth, json={"is_demo": marker}).status_code == 422
    invalid = client.patch(BASE + "/restaurant", headers=auth, json={"address": ""})
    assert invalid.status_code == 422 and "Publishing requires" in invalid.text
    assert client.patch(BASE + "/restaurant", headers=auth, json={"published": False}).status_code == 200
    assert client.patch(BASE + "/restaurant", headers=auth, json={"address": ""}).status_code == 200
    invalid = client.patch(BASE + "/restaurant", headers=auth, json={"published": True})
    assert invalid.status_code == 422 and "Publishing requires" in invalid.text
    saved = client.get(BASE + "/restaurant", headers=auth).json()
    assert saved["is_demo"] is True and saved["published"] is False
    assert saved["website_settings"]["theme"] == "emerald"
    assert client.patch(BASE + "/restaurant", headers=auth, json={
        "address": "Sample address", "published": True}).status_code == 200


def test_real_order_tracking_and_retries_survive_unpublication(api):
    client, factory, password = api
    payload = order_payload(client)
    original = create_order(client, payload, key="real-unpublish-key")
    assert original.status_code == 201
    order = original.json()
    auth = login(client, password)
    assert client.patch(BASE + "/restaurant", headers=auth, json={"published": False}).status_code == 200
    tracked = client.get(BASE + "/public/orders/" + order["tracking_token"])
    assert tracked.status_code == 200
    assert tracked.json()["reference"] == order["reference"]
    assert create_order(client, payload, key="real-unpublish-key").json() == order
    assert create_order(client, payload, key="real-new-key").status_code == 404


@pytest.mark.parametrize("is_demo", [False, True])
def test_legacy_replay_adds_actual_marker_without_changing_original_snapshot(api, is_demo):
    client, factory, password = api
    if is_demo:
        make_sample(factory)
    payload = order_payload(client)
    original = create_order(client, payload, key="legacy-marker-key")
    assert original.status_code == 201
    snapshot = original.json()
    assert snapshot["is_demo"] is is_demo
    legacy = {key: value for key, value in snapshot.items() if key != "is_demo"}
    with factory() as db:
        order = db.get(m.Order, snapshot["id"])
        order.creation_response = legacy
        order.status = "CONFIRMED"
        restaurant = db.get(m.Restaurant, order.restaurant_id)
        restaurant.published = False
        db.commit()
    replay = create_order(client, payload, key="legacy-marker-key")
    assert replay.status_code == 201
    assert replay.json() == snapshot
    tracking = client.get(BASE + "/public/orders/" + snapshot["tracking_token"])
    assert tracking.status_code == 200
    assert tracking.json()["is_demo"] is is_demo
    assert tracking.json()["status"] == "CONFIRMED"
    assert not {"tracking_token", "tracking_hash", "idempotency_key", "payload_hash",
                "creation_response", "restaurant_id", "customer_name", "email",
                "phone", "address", "notes"} & tracking.json().keys()
    auth = login(client, password)
    owner_order = client.get(BASE + "/orders/" + snapshot["id"], headers=auth)
    assert owner_order.status_code == 200
    assert owner_order.json()["is_demo"] is is_demo
    with factory() as db:
        assert db.get(m.Order, snapshot["id"]).creation_response == legacy
