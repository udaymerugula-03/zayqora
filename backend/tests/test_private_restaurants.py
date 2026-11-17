from sqlalchemy import func, select

from app import models as m
from conftest import booking_payload, create_order, login, order_payload

BASE = "/api/v1"
PUBLIC = BASE + "/public/restaurants/saffron-table"


def make_private(factory):
    with factory() as db:
        restaurant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        restaurant.is_demo = True
        db.commit()


def counts(factory):
    with factory() as db:
        return tuple(db.scalar(select(func.count()).select_from(model))
                     for model in (m.Order, m.Reservation, m.ContactInquiry, m.Outbox))


def test_private_restaurant_blocks_public_reads_writes_and_checkout_replay(api):
    client, factory, password = api
    payload = order_payload(client)
    original = create_order(client, payload, key="private-replay-key")
    assert original.status_code == 201
    order = original.json()
    before = counts(factory)
    booking = booking_payload()
    make_private(factory)

    listed = client.get(BASE + "/public/restaurants", params={"page_size": 1}).json()
    assert listed["total"] == 1
    assert [tenant["slug"] for tenant in listed["items"]] == ["other-tenant"]
    for path in (PUBLIC, PUBLIC + "/menu"):
        assert client.get(path).status_code == 404
    assert client.get(PUBLIC + "/availability", params={
        "date": booking["starts_at"][:10], "party_size": 4}).status_code == 404
    assert client.post(PUBLIC + "/quote", json={
        "items": payload["items"], "fulfilment": payload["fulfilment"]}).status_code == 404
    for key in ("private-replay-key", "private-new-key"):
        assert create_order(client, payload, key=key).status_code == 404
    assert client.post(PUBLIC + "/reservations", json=booking).status_code == 404
    assert client.post(PUBLIC + "/inquiries", json={
        "customer_name": "Guest", "email": "guest@example.com", "subject": "Question",
        "message": "A valid contact question.", "consent": True}).status_code == 404
    assert client.get(BASE + "/public/orders/" + order["tracking_token"]).status_code == 404
    assert counts(factory) == before

    auth = login(client, password)
    assert client.get(BASE + "/restaurant", headers=auth).json()["is_demo"] is True
    assert client.get(BASE + "/menu/categories", headers=auth).status_code == 200
    assert client.get(BASE + "/orders/" + order["id"], headers=auth).status_code == 200
    admin = login(client, password, "admin@example.com")
    tenants = client.get(BASE + "/platform/tenants", headers=admin).json()
    assert any(tenant["is_demo"] for tenant in tenants["items"])
    overview = client.get(BASE + "/platform/overview", headers=admin).json()
    assert overview["total_tenants"] == 2 and overview["published_restaurants"] == 1


def test_private_owner_can_edit_and_unpublish_but_cannot_publish_or_clear_marker(api):
    client, factory, password = api
    make_private(factory)
    auth = login(client, password)
    changed = client.patch(BASE + "/restaurant", headers=auth, json={
        "tagline": "Private saved content", "website_settings": {"theme": "emerald"}})
    assert changed.status_code == 200, changed.text
    assert changed.json()["is_demo"] is True
    for published in (True, False, True):
        response = client.patch(BASE + "/restaurant", headers=auth, json={"published": published})
        assert response.status_code == (422 if published else 200)
    assert client.patch(BASE + "/restaurant", headers=auth, json={"is_demo": False}).status_code == 422
    saved = client.get(BASE + "/restaurant", headers=auth).json()
    assert saved["is_demo"] is True and saved["published"] is False
    assert saved["website_settings"]["theme"] == "emerald"


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
