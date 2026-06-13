"""vehicles, vehicle_images, company_favorites

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enums
    fuel_type = postgresql.ENUM("gasoline", "diesel", "electric", "hybrid", "gnc", name="fueltype", create_type=False)
    transmission = postgresql.ENUM("manual", "automatic", name="transmission", create_type=False)
    vehicle_condition = postgresql.ENUM("new", "used", name="vehiclecondition", create_type=False)
    vehicle_status = postgresql.ENUM("available", "reserved", "sold", name="vehiclestatus", create_type=False)

    for enum in (fuel_type, transmission, vehicle_condition, vehicle_status):
        enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "vehicles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("brand", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("version", sa.String(100), nullable=True),
        sa.Column("color", sa.String(50), nullable=False),
        sa.Column("mileage", sa.Integer(), nullable=False),
        sa.Column("fuel_type", sa.Enum("gasoline", "diesel", "electric", "hybrid", "gnc", name="fueltype"), nullable=False),
        sa.Column("transmission", sa.Enum("manual", "automatic", name="transmission"), nullable=False),
        sa.Column("condition", sa.Enum("new", "used", name="vehiclecondition"), nullable=False),
        sa.Column("body_type", sa.String(50), nullable=True),
        sa.Column("price_resale", sa.Numeric(12, 2), nullable=False),
        sa.Column("price_public", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("available", "reserved", "sold", name="vehiclestatus"), nullable=False, server_default="available"),
        sa.Column("share_token", postgresql.UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "vehicle_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("s3_key", sa.String(500), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "company_favorites",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("favorite_company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("company_favorites")
    op.drop_table("vehicle_images")
    op.drop_table("vehicles")

    for name in ("vehiclestatus", "vehiclecondition", "transmission", "fueltype"):
        op.execute(f"DROP TYPE IF EXISTS {name}")
