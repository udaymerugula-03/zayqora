import importlib.util
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

from app.db import Base
from app import models


def load_revision(filename):
    path = Path(__file__).resolve().parents[1] / "migrations" / "versions" / filename
    spec = importlib.util.spec_from_file_location(filename.replace(".", "_"), path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    return revision


def test_initial_migration_matches_models_and_downgrades():
    revision = load_revision("0001_release_one.py")
    website = load_revision("0002_website_inquiries.py")
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            revision.upgrade()
            website.upgrade()
            assert compare_metadata(context, Base.metadata) == []
            website.downgrade()
            revision.downgrade()
        assert inspect(connection).get_table_names() == []


def test_demo_backfill_only_marks_identified_fictional_tenants(database_engine):
    revision = load_revision("0001_release_one.py")
    website = load_revision("0002_website_inquiries.py")
    engine = database_engine
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            schema = engine.get_execution_options()["schema_translate_map"][None]
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        with Operations.context(MigrationContext.configure(connection)):
            revision.upgrade()
            table = models.Restaurant.__table__
            old_columns = [c.name for c in table.columns if c.name not in {"website_settings", "is_demo"}]
            for slug, description in (
                ("saffron-table", "A DEMONSTRATION RESTAURANT"),
                ("garden-cafe", "A real independent business"),
                ("another-demo", "demonstration restaurant"),
            ):
                values = {
                    "id": slug, "slug": slug, "name": slug, "description": description,
                    "opening_hours": "{}",
                }
                for column in old_columns:
                    if column in values or column == "plan_id":
                        continue
                    if column in {"published", "allow_pickup", "allow_delivery", "tax_inclusive"}:
                        values[column] = False
                    elif column in {"delivery_fee", "minimum_order", "tax_rate",
                                    "reservation_duration_minutes", "reservation_buffer_minutes",
                                    "reservation_days_ahead"}:
                        values[column] = 0
                    else:
                        values[column] = ""
                columns = ", ".join(values)
                placeholders = ", ".join(":" + key for key in values)
                connection.execute(text(f"INSERT INTO restaurants ({columns}) VALUES ({placeholders})"), values)
            website.upgrade()
            rows = connection.execute(text(
                "SELECT slug, is_demo, website_settings FROM restaurants")).all()
            assert {row[0]: bool(row[1]) for row in rows} == {
                "saffron-table": True, "garden-cafe": False, "another-demo": False}
            assert all(row[2] in ({}, "{}") for row in rows)
            website.downgrade()
            preserved = connection.execute(text("SELECT slug, description FROM restaurants")).all()
            assert len(preserved) == 3
            assert dict(preserved)["garden-cafe"] == "A real independent business"
