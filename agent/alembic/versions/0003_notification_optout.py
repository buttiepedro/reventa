"""let a user turn off WhatsApp notifications

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

SCHEMA = "agent"


def upgrade() -> None:
    # WhatsApp is a personal channel and each message costs money. Linking the
    # number must not mean accepting whatever the platform decides to send.
    op.add_column(
        "whatsapp_links",
        sa.Column("notifications_enabled", sa.Boolean, nullable=False, server_default="true"),
        schema=SCHEMA,
    )
    op.create_table(
        "outbound_notifications",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phone_e164", sa.String(20), nullable=False),
        sa.Column("template", sa.String(64), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("detail", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        schema=SCHEMA,
    )
    op.create_index("ix_outbound_notifications_user_id", "outbound_notifications", ["user_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("outbound_notifications", schema=SCHEMA)
    op.drop_column("whatsapp_links", "notifications_enabled", schema=SCHEMA)
