"""sheet_config table and external_id on vehicles

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-15
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vehicles", sa.Column("external_id", sa.String(200), nullable=True))
    op.create_index("ix_vehicles_external_id", "vehicles", ["external_id"])
    op.create_unique_constraint("uq_vehicles_company_external_id", "vehicles", ["company_id", "external_id"])

    op.create_table(
        "company_sheet_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sheet_url", sa.String(500), nullable=False),
        sa.Column("column_mapping", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("has_header_row", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("company_id", name="uq_sheet_config_company"),
    )


def downgrade() -> None:
    op.drop_table("company_sheet_configs")
    op.drop_constraint("uq_vehicles_company_external_id", "vehicles", type_="unique")
    op.drop_index("ix_vehicles_external_id", table_name="vehicles")
    op.drop_column("vehicles", "external_id")
