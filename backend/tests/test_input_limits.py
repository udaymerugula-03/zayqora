from conftest import booking_payload, cart, login, order_payload


def test_persisted_name_limits_return_422_not_database_errors(api):
    client, factory, password = api
    owner = login(client, password)
    admin = login(client, password, "admin@example.com")
    assert client.post("/api/v1/auth/register", json={
        "full_name": "n" * 151, "email": "long@example.com", "password": password,
        "restaurant_name": "Example", "slug": "name-too-long"}).status_code == 422
    assert client.post("/api/v1/menu/categories", headers=owner,
                       json={"name": "n" * 121}).status_code == 422
    assert client.post("/api/v1/tables", headers=owner,
                       json={"name": "n" * 101, "capacity": 4}).status_code == 422
    assert client.post("/api/v1/platform/plans", headers=admin, json={
        "name": "n" * 121, "max_menu_items": 30}).status_code == 422
    payload = order_payload(client)
    payload["customer_name"] = "n" * 151
    assert client.post("/api/v1/public/restaurants/saffron-table/orders", json=payload,
                       headers={"Idempotency-Key": "overlong-name-key"}).status_code == 422
    booking = booking_payload()
    booking["customer_name"] = "n" * 151
    assert client.post("/api/v1/public/restaurants/saffron-table/reservations",
                       json=booking).status_code == 422
    selection, item = cart(client)
    assert client.patch("/api/v1/menu/categories/" + item["category_id"], headers=owner,
                        json={"name": "n" * 121}).status_code == 422
