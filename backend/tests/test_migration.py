import importlib.util
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect

from app.db import Base
from app import models


def test_initial_migration_matches_models_and_downgrades():
    path = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "0001_release_one.py"
    spec = importlib.util.spec_from_file_location("release_one_revision", path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            revision.upgrade()
            assert compare_metadata(context, Base.metadata) == []
            revision.downgrade()
        assert inspect(connection).get_table_names() == []
