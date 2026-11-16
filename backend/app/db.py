import os

import certifi
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from fastapi import Request


class Base(DeclarativeBase):
    pass


def make_engine(url):
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    parsed = make_url(url)
    connect_args = {}
    if (parsed.query.get("sslmode") == "verify-full"
            and not parsed.query.get("sslrootcert") and not os.getenv("PGSSLROOTCERT")):
        # Bundled libpq on Windows does not automatically use the native CA store.
        connect_args["sslrootcert"] = certifi.where()
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


def get_db(request: Request):
    with request.app.state.session_factory() as session:
        yield session


def configure_db(app, url):
    engine = make_engine(url)
    app.state.engine = engine
    app.state.session_factory = sessionmaker(engine, expire_on_commit=False)
