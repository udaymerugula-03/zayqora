import pytest
from sqlalchemy import select

from app import models as m
from conftest import booking_payload, create_order, login


@pytest.mark.parametrize("target", ["REJECTED", "CANCELLED"])
def test_order_requires_nonblank_reason_and_records_it_atomically(api, target):
    client, factory, password = api
    auth = login(client, password)
    order = create_order(client).json()
    path = "/api/v1/orders/" + order["id"] + "/status"
    for fields in ({}, {"reason": ""}, {"reason": "   "}, {"reason": "ab"}):
        response = client.patch(path, headers=auth, json={"status": target, **fields})
        assert response.status_code == 422
        assert response.json()["code"] == "reason_required"
    with factory() as db:
        stored = db.get(m.Order, order["id"])
        assert stored.status == "PENDING" and len(stored.history) == 1
        assert not db.scalar(select(m.Audit).where(m.Audit.kind == "order.status"))
    response = client.patch(path, headers=auth, json={
        "status": target, "reason": "  Kitchen cannot fulfil the request.  "})
    assert response.status_code == 200
    assert response.json()["history"][-1]["reason"] == "Kitchen cannot fulfil the request."
    with factory() as db:
        event = db.scalar(select(m.Audit).where(m.Audit.kind == "order.status"))
        assert event.reason == "Kitchen cannot fulfil the request."


@pytest.mark.parametrize("target", ["DECLINED", "CANCELLED"])
def test_reservation_requires_reason_and_audits_valid_change(api, target):
    client, factory, password = api
    auth = login(client, password)
    reservation = client.post("/api/v1/public/restaurants/saffron-table/reservations",
                              json=booking_payload()).json()
    path = "/api/v1/reservations/" + reservation["id"] + "/status"
    for reason in ("", "  ", "ab"):
        response = client.patch(path, headers=auth, json={"status": target, "reason": reason})
        assert response.status_code == 422
        assert response.json()["code"] == "reason_required"
    with factory() as db:
        assert db.get(m.Reservation, reservation["id"]).status == "REQUESTED"
        assert not db.scalar(select(m.Audit).where(m.Audit.kind == "reservation.status"))
    response = client.patch(path, headers=auth, json={
        "status": target, "reason": "Guest requested a different date."})
    assert response.status_code == 200
    with factory() as db:
        event = db.scalar(select(m.Audit).where(m.Audit.kind == "reservation.status"))
        assert event.reason == "Guest requested a different date."


def test_paid_pending_cannot_be_rejected_or_cancelled_even_with_reason(api):
    client, factory, password = api
    auth = login(client, password)
    order = create_order(client).json()
    path = "/api/v1/orders/" + order["id"]
    assert client.post(path + "/cash-payment", headers=auth).status_code == 200
    for target in ("REJECTED", "CANCELLED"):
        response = client.patch(path + "/status", headers=auth, json={
            "status": target, "reason": "A reason does not implement a cash refund."})
        assert response.status_code == 409
    with factory() as db:
        stored = db.get(m.Order, order["id"])
        assert stored.status == "PENDING" and stored.payment_status == "paid"
