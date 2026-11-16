from alembic import context
from app.config import settings
from app.db import Base, make_engine
from app import models

config = settings()
config.validate_runtime()
target_metadata = Base.metadata

if context.is_offline_mode():
    url = config.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = make_engine(config.database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
