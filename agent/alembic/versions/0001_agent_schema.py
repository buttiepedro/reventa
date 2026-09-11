"""create agent schema tables

Revision ID: 0001
Revises:
Create Date: 2026-09-10
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = "agent"


def upgrade() -> None:
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')

    op.create_table(
        "whatsapp_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("phone_e164", sa.String(20), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("code_hash", sa.String(60), nullable=True),
        sa.Column("code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        schema=SCHEMA,
    )
    op.create_index("ix_whatsapp_links_user_id", "whatsapp_links", ["user_id"], schema=SCHEMA)
    op.create_index("ix_whatsapp_links_phone_e164", "whatsapp_links", ["phone_e164"], schema=SCHEMA)
    # One live link per number; revoked rows stay for audit and are excluded here.
    op.create_index(
        "uq_whatsapp_links_active_phone",
        "whatsapp_links",
        ["phone_e164"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL AND phone_e164 IS NOT NULL"),
        schema=SCHEMA,
    )

    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("phone_e164", sa.String(20), nullable=False, unique=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("messages", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("pending_action", JSONB, nullable=True),
        sa.Column("pending_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("messages_today", sa.Integer, nullable=False, server_default="0"),
        sa.Column("quota_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        schema=SCHEMA,
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"], schema=SCHEMA)

    op.create_table(
        "inbound_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("meta_message_id", sa.String(128), nullable=False, unique=True),
        sa.Column("phone_e164", sa.String(20), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    op.create_index("ix_inbound_messages_phone_e164", "inbound_messages", ["phone_e164"], schema=SCHEMA)

    op.create_table(
        "agent_actions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("phone_e164", sa.String(20), nullable=False),
        sa.Column("tool", sa.String(64), nullable=False),
        sa.Column("arguments", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("response", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        schema=SCHEMA,
    )
    op.create_index("ix_agent_actions_user_id", "agent_actions", ["user_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("agent_actions", schema=SCHEMA)
    op.drop_table("inbound_messages", schema=SCHEMA)
    op.drop_table("conversations", schema=SCHEMA)
    op.drop_table("whatsapp_links", schema=SCHEMA)
