"""Idempotent, explicitly labelled demo tenants; credentials are never logged."""
import argparse
import json
import os
import secrets
import subprocess
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from . import models as m
from .config import ROOT, settings
from .db import make_engine
from .security import passwords


def seed(db):
    plan = db.scalar(select(m.Plan).where(m.Plan.name == "Launch"))
    if not plan:
        plan = m.Plan(name="Launch", description="Release 1 demonstration plan.", max_menu_items=30)
        db.add(plan)
        db.flush()
    credentials = {}
    for slug, name, email in (
        ("saffron-table", "Saffron Table", "owner@zayqora.demo"),
        ("garden-cafe", "Garden Café", "garden@zayqora.demo"),
    ):
        restaurant = db.scalar(select(m.Restaurant).where(m.Restaurant.slug == slug))
        if restaurant and "demonstration restaurant" not in restaurant.description.lower():
            raise RuntimeError("Refusing to attach demo accounts to an existing non-demo restaurant.")
        if not restaurant:
            restaurant = m.Restaurant(
                slug=slug, name=name, tagline="A ZAYQORA demonstration restaurant",
                description="Demonstration restaurant and menu, not a claim of a real operating business.",
                city="Karachi", address="Demonstration address, Karachi, Pakistan",
                phone="+92 300 0000000", email=email, published=True,
                allow_delivery=True, delivery_fee="150.00", minimum_order="0.00",
                plan_id=plan.id, tax_rate="0.00", opening_hours=m.hours())
            db.add(restaurant)
            db.flush()
            category = m.Category(restaurant_id=restaurant.id, name="Demonstration menu",
                                  position=0, published=True)
            db.add(category)
            db.flush()
            for item_name, price, image in (
                ("Chicken Biryani", "650.00", "biryani"),
                ("Chicken Karahi", "1250.00", "karahi"),
                ("Beef Burger", "750.00", "burger"),
                ("Margherita Pizza", "1100.00", "pizza"),
                ("Chocolate Dessert", "400.00", "dessert"),
                ("Freshly Brewed Coffee", "350.00", "drink"),
            ):
                db.add(m.MenuItem(
                    restaurant_id=restaurant.id, category_id=category.id,
                    name=item_name, description="Demonstration menu item",
                    price=price, image_url=f"/food/{image}.jpg", published=True,
                    featured=image in {"biryani", "karahi", "burger"},
                    variants=[{"id": m.uid(), "name": "Large", "price_delta": "200.00"}],
                    modifiers=[{"id": m.uid(), "name": "Extra sauce", "price_delta": "50.00"}]))
            for number, capacity in ((1, 2), (2, 4), (3, 6)):
                db.add(m.DiningTable(restaurant_id=restaurant.id, name=f"Table {number}", capacity=capacity))
        if not db.scalar(select(m.User).where(m.User.email == email)):
            password = secrets.token_urlsafe(24)
            db.add(m.User(email=email, full_name=f"{name} Demo Owner", restaurant_id=restaurant.id,
                          password_hash=passwords.hash(password), email_verified=True))
            credentials[email] = {"password": password, "role": "owner", "restaurant_slug": slug}
    email = "admin@zayqora.demo"
    if not db.scalar(select(m.User).where(m.User.email == email)):
        password = secrets.token_urlsafe(24)
        db.add(m.User(email=email, full_name="ZAYQORA Demo Platform Administrator",
                      password_hash=passwords.hash(password), email_verified=True,
                      role="platform_admin"))
        credentials[email] = {"password": password, "role": "platform_admin"}
    return credentials


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--credentials-output", type=Path, default=ROOT / ".demo-credentials.json")
    args = parser.parse_args()
    output = args.credentials_output.resolve()
    if not output.is_relative_to(ROOT):
        raise SystemExit("Credential output must be a private path inside the project root.")
    # Refuse accidental public or source-file output. Root path must be ignored by infrastructure.
    if not output.name.startswith(".") or output.suffix != ".json":
        raise SystemExit("Use an ignored hidden .json credential output path.")
    if subprocess.run(["git", "check-ignore", "--quiet", str(output)], cwd=ROOT,
                      capture_output=True).returncode != 0:
        raise SystemExit("Credential output must be gitignored before seeding.")
    config = settings()
    config.validate_runtime()
    factory = sessionmaker(make_engine(config.database_url), expire_on_commit=False)
    with factory() as db:
        credentials = seed(db)
        if credentials:
            existing = json.loads(output.read_text()) if output.exists() else {}
            existing.update(credentials)
            output.parent.mkdir(exist_ok=True, parents=True)
            flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
            fd = os.open(output, flags, 0o600)
            with os.fdopen(fd, "w") as file:
                json.dump(existing, file, indent=2)
            db.commit()
        else:
            db.commit()
    print("Demo seed complete. Credentials, if newly generated, were written to the private output file.")


if __name__ == "__main__":
    main()
