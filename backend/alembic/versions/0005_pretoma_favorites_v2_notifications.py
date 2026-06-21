"""pre_toma status, favorites v2 (confirmation), notifications, pre_toma_interests

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-21
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add pre_toma value to vehiclestatus enum
    op.execute("ALTER TYPE vehiclestatus ADD VALUE IF NOT EXISTS 'pre_toma'")

    # 2. Alter company_favorites: add status + requested_by_id columns
    op.add_column(
        "company_favorites",
        sa.Column("status", sa.String(20), nullable=False, server_default="accepted"),
    )
    op.add_column(
        "company_favorites",
        sa.Column(
            "requested_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id"),
            nullable=True,
        ),
    )
    # Backfill: requester is always company_id for existing records
    op.execute("UPDATE company_favorites SET requested_by_id = company_id WHERE requested_by_id IS NULL")
    op.alter_column("company_favorites", "requested_by_id", nullable=False)

    # 3. Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False, server_default=""),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 4. Create pre_toma_interests table
    op.create_table(
        "pre_toma_interests",
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("pre_toma_interests")
    op.drop_table("notifications")
    op.drop_column("company_favorites", "requested_by_id")
    op.drop_column("company_favorites", "status")
    # Note: removing enum values in PostgreSQL requires recreating the type
