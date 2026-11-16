import os
import secrets
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models as m
from app.config import Settings
from app.db import Base, make_engine
from app.main import create_app
from app.security import passwords


@pytest.fixture
def database_engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if url:
        if not url.startswith(("postgresql://", "postgresql+psycopg://")):
            pytest.fail("TEST_DATABASE_URL must be an isolated PostgreSQL database.")
        engine = make_engine(url)
        schema = "zayqora_business_test_" + secrets.token_hex(8)
        with engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        try:
            yield engine.execution_options(schema_translate_map={None: schema})
        finally:
            with engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            engine.dispose()
    else:
        engine = create_engine("sqlite://", poolclass=StaticPool,
                               connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def enable_fks(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")

        try:
            yield engine
        finally:
            engine.dispose()


@pytest.fixture
def api(database_engine):
    config = Settings(_env_file=None, database_url="sqlite://",
                      secret_key=secrets.token_urlsafe(48), app_env="development")
    engine = database_engine
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    app = create_app(config, testing=True)
    app.state.engine = engine
    app.state.session_factory = factory
    password = secrets.token_urlsafe(18)
    hashed = passwords.hash(password)
    with factory() as db:
        plan = m.Plan(name="Test", description="", max_menu_items=10)
        db.add(plan)
        db.flush()
        for i, slug in enumerate(("saffron-table", "other-tenant")):
            restaurant = m.Restaurant(
                slug=slug, name=f"Demo {i}", email=f"owner{i}@example.com",
                address="Demo address", city="Karachi", phone="03001234567",
                published=True, allow_delivery=True, delivery_fee="100.00", plan_id=plan.id)
            db.add(restaurant)
            db.flush()
            user = m.User(email=f"owner{i}@example.com", full_name=f"Demo Owner {i}",
                          password_hash=hashed, restaurant_id=restaurant.id, email_verified=True)
            db.add(user)
            category = m.Category(restaurant_id=restaurant.id, name="Main", published=True)
            db.add(category)
            db.flush()
            db.add(m.MenuItem(restaurant_id=restaurant.id, category_id=category.id,
                             name="Biryani", price="500.00", published=True,
                             variants=[{"id": f"large{i}", "name": "Large", "price_delta": "100.00"}],
                             modifiers=[{"id": f"sauce{i}", "name": "Sauce", "price_delta": "50.00"}]))
            db.add(m.DiningTable(restaurant_id=restaurant.id, name="Only table", capacity=4))
        db.add(m.User(email="admin@example.com", full_name="Admin", role="platform_admin",
                      password_hash=hashed, email_verified=True))
        db.commit()
    with TestClient(app) as client:
        yield client, factory, password


def login(client, password, email="owner0@example.com"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def cart(client, slug="saffron-table"):
    menu = client.get(f"/api/v1/public/restaurants/{slug}/menu").json()
    item = menu["categories"][0]["items"][0]
    return {"items": [{"menu_item_id": item["id"], "quantity": 2, "variant_id": None,
                       "modifier_ids": [], "notes": "private line notes"}],
            "fulfilment": "pickup"}, item


def order_payload(client, slug="saffron-table"):
    selection, item = cart(client, slug)
    quoted = client.post(f"/api/v1/public/restaurants/{slug}/quote", json=selection)
    assert quoted.status_code == 200, quoted.text
    return {**selection, "quote_token": quoted.json()["quote_token"],
            "customer_name": "Guest Example", "email": "guest@example.com",
            "phone": "03001234567", "address": "", "notes": "private staff notes", "consent": True}


def create_order(client, payload=None, key="test-key-123", slug="saffron-table"):
    payload = payload or order_payload(client, slug)
    return client.post(f"/api/v1/public/restaurants/{slug}/orders", json=payload,
                       headers={"Idempotency-Key": key})


def booking_payload():
    tomorrow = m.now().astimezone(timezone(timedelta(hours=5))).date() + timedelta(days=1)
    starts = datetime.combine(tomorrow, datetime.min.time(), timezone(timedelta(hours=5))) + timedelta(hours=12)
    return {"starts_at": starts.isoformat(), "party_size": 4, "customer_name": "Guest Example",
            "email": "guest@example.com", "phone": "03001234567", "notes": "", "consent": True}
