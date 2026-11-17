import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app import models as m
from app.db import Base
from app.security import passwords
from app.seed import seed


def test_demo_seed_uses_simple_emails_and_preserves_existing_credentials(database_engine):
    Base.metadata.create_all(database_engine)
    factory = sessionmaker(database_engine, expire_on_commit=False)
    with factory() as db:
        generated = seed(db)
        db.commit()
        assert set(generated) == {
            "owner@zayqora.demo", "garden@zayqora.demo", "admin@zayqora.demo",
        }
        owner = db.scalar(select(m.User).where(m.User.email == "owner@zayqora.demo"))
        restaurant = db.get(m.Restaurant, owner.restaurant_id)
        assert restaurant.slug == "saffron-table"
        assert restaurant.is_demo is True
        assert restaurant.currency == "PKR" and restaurant.timezone == "Asia/Karachi"
        assert passwords.verify(owner.password_hash, generated[owner.email]["password"])
        owner.password_hash = passwords.hash(secrets.token_urlsafe(24))
        retained_hash = owner.password_hash
        retained_id = owner.id
        db.commit()
        assert seed(db) == {}
        db.commit()
        assert db.get(m.User, retained_id).password_hash == retained_hash
        assert db.scalar(select(func.count()).select_from(m.User)) == 3
        assert db.scalar(select(func.count()).select_from(m.Restaurant)) == 2
        assert all(tenant.is_demo for tenant in db.scalars(select(m.Restaurant)))
