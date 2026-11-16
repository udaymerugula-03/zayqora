"""Initial ZAYQORA Release 1 schema (frozen table definitions)."""
from alembic import op
import sqlalchemy as sa

revision = "0001_release_one"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("plans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("max_menu_items", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False))
    op.create_table("restaurants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("tagline", sa.String(250), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("cuisine", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("phone", sa.String(50), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("timezone", sa.String(60), nullable=False),
        sa.Column("logo_url", sa.Text(), nullable=False),
        sa.Column("hero_image_url", sa.Text(), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("allow_pickup", sa.Boolean(), nullable=False),
        sa.Column("allow_delivery", sa.Boolean(), nullable=False),
        sa.Column("delivery_fee", sa.Numeric(12, 2), nullable=False),
        sa.Column("minimum_order", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax_rate", sa.Numeric(6, 2), nullable=False),
        sa.Column("tax_inclusive", sa.Boolean(), nullable=False),
        sa.Column("opening_hours", sa.JSON(), nullable=False),
        sa.Column("reservation_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("reservation_buffer_minutes", sa.Integer(), nullable=False),
        sa.Column("reservation_days_ahead", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.String(36), sa.ForeignKey("plans.id")))
    op.create_table("users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id")),
        sa.Column("email_verified", sa.Boolean(), nullable=False))
    op.create_table("sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False))
    op.create_table("verifications",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False))
    op.create_table("categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("id", "restaurant_id"))
    op.create_index("ix_categories_restaurant_id", "categories", ["restaurant_id"])
    op.create_table("menu_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("category_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("available", sa.Boolean(), nullable=False),
        sa.Column("published", sa.Boolean(), nullable=False),
        sa.Column("featured", sa.Boolean(), nullable=False),
        sa.Column("variant_required", sa.Boolean(), nullable=False),
        sa.Column("variants", sa.JSON(), nullable=False),
        sa.Column("modifiers", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["category_id", "restaurant_id"], ["categories.id", "categories.restaurant_id"]))
    op.create_index("ix_menu_items_restaurant_id", "menu_items", ["restaurant_id"])
    op.create_table("orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("reference", sa.String(30), nullable=False, unique=True),
        sa.Column("tracking_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("creation_response", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("payment_status", sa.String(20), nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=False),
        sa.Column("fulfilment", sa.String(20), nullable=False),
        sa.Column("customer_name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("phone", sa.String(50), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
        sa.Column("delivery_fee", sa.Numeric(12, 2), nullable=False),
        sa.Column("tax", sa.Numeric(12, 2), nullable=False),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("history", sa.JSON(), nullable=False),
        sa.UniqueConstraint("restaurant_id", "idempotency_key"))
    op.create_index("ix_orders_restaurant_id", "orders", ["restaurant_id"])
    op.create_table("dining_tables",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("id", "restaurant_id"))
    op.create_index("ix_dining_tables_restaurant_id", "dining_tables", ["restaurant_id"])
    op.create_table("reservations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("reference", sa.String(30), nullable=False, unique=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("customer_name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("phone", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("table_id", sa.String(36), nullable=False),
        sa.ForeignKeyConstraint(["table_id", "restaurant_id"], ["dining_tables.id", "dining_tables.restaurant_id"]))
    op.create_index("ix_reservations_restaurant_id", "reservations", ["restaurant_id"])
    op.create_index("ix_reservations_starts_at", "reservations", ["starts_at"])
    op.create_table("audit_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id")),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("outbox",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id")),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("recipient", sa.String(254), nullable=False),
        sa.Column("subject", sa.String(250), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_outbox_restaurant_id", "outbox", ["restaurant_id"])


def downgrade():
    for table in ("outbox", "audit_events", "reservations", "dining_tables", "orders",
                  "menu_items", "categories", "verifications", "sessions", "users",
                  "restaurants", "plans"):
        op.drop_table(table)
