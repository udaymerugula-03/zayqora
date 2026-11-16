"""Real lock semantics; skips unless an isolated PostgreSQL URL is explicitly supplied."""
import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app import models as m
from app.config import Settings
from app.db import Base, make_engine
from app.main import create_app
from app.seed import seed
from conftest import booking_payload, create_order, order_payload

pytestmark = pytest.mark.postgres


@pytest.fixture
def postgres_api():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL database for real row-lock tests.")
    if not url.startswith(("postgresql://", "postgresql+psycopg://")):
        pytest.fail("TEST_DATABASE_URL must be PostgreSQL.")
    url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    schema = "zayqora_test_" + secrets.token_hex(8)
    engine = make_engine(url)
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    scoped_engine = engine.execution_options(schema_translate_map={None: schema})
    Base.metadata.create_all(scoped_engine)
    factory = sessionmaker(scoped_engine, expire_on_commit=False)
    with factory() as db:
        seed(db)
        tenant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == "saffron-table"))
        for table in db.scalars(select(m.DiningTable).where(m.DiningTable.restaurant_id == tenant.id)):
            table.active = table.capacity == 4
        db.commit()
    app = create_app(Settings(_env_file=None, database_url=url,
                             secret_key=secrets.token_urlsafe(48)), testing=True)
    app.state.engine = scoped_engine
    app.state.session_factory = factory
    try:
        with TestClient(app) as client:
            yield client, factory
    finally:
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()


def test_concurrent_reservations_allocate_only_once(postgres_api):
    client, factory = postgres_api
    payload = booking_payload()
    barrier = Barrier(2)

    def book():
        barrier.wait(timeout=10)
        return client.post("/api/v1/public/restaurants/saffron-table/reservations", json=payload)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: book(), range(2)))
    assert sorted(result.status_code for result in results) == [201, 409]
    with factory() as db:
        assert len(list(db.scalars(select(m.Reservation)))) == 1


def test_concurrent_checkout_replays_original_tracking(postgres_api):
    client, factory = postgres_api
    payload = order_payload(client)
    barrier = Barrier(2)

    def checkout():
        barrier.wait(timeout=10)
        return create_order(client, payload, key="concurrent-checkout")

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: checkout(), range(2)))
    assert [result.status_code for result in results] == [201, 201]
    assert results[0].json() == results[1].json()
    with factory() as db:
        assert len(list(db.scalars(select(m.Order)))) == 1
