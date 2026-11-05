"""historial de precios por modelo

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-04
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vehicle_price_points",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=True),
        sa.Column("brand", sa.String(100), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("version", sa.String(100), nullable=True),
        sa.Column("mileage", sa.Integer, nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("price_resale", sa.Numeric(12, 2), nullable=True),
        sa.Column("price_public", sa.Numeric(12, 2), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_price_points_vehicle_id", "vehicle_price_points", ["vehicle_id"])
    op.create_index("ix_price_points_kind", "vehicle_price_points", ["kind"])
    op.create_index("ix_price_points_recorded_at", "vehicle_price_points", ["recorded_at"])
    # La consulta del tasador siempre entra por marca, modelo y año.
    op.create_index("ix_price_points_modelo", "vehicle_price_points", ["brand", "model", "year"])


def downgrade() -> None:
    op.drop_table("vehicle_price_points")
