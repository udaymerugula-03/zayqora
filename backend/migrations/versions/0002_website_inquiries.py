"""Release 1 configurable website and tenant contact inbox."""
from alembic import op
import sqlalchemy as sa

revision = "0002_website_inquiries"
down_revision = "0001_release_one"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("restaurants", sa.Column("website_settings", sa.JSON(), nullable=False,
                                          server_default=sa.text("'{}'")))
    op.add_column("restaurants", sa.Column("is_demo", sa.Boolean(), nullable=False,
                                          server_default=sa.false()))
    op.execute(sa.text(
        "UPDATE restaurants SET is_demo = true "
        "WHERE slug IN ('saffron-table', 'garden-cafe') "
        "AND lower(description) LIKE '%demonstration restaurant%'"))
    op.create_table(
        "contact_inquiries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("restaurant_id", sa.String(36), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("reference", sa.String(30), nullable=False, unique=True),
        sa.Column("customer_name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("subject", sa.String(160), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_contact_inquiries_restaurant_id", "contact_inquiries", ["restaurant_id"])


def downgrade():
    op.drop_index("ix_contact_inquiries_restaurant_id", table_name="contact_inquiries")
    op.drop_table("contact_inquiries")
    op.drop_column("restaurants", "is_demo")
    op.drop_column("restaurants", "website_settings")
