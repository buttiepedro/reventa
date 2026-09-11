"""buffer inbound photos before a draft

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-10
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SCHEMA = "agent"


def upgrade() -> None:
    # WhatsApp delivers one webhook per photo, so a three-photo upload arrives as
    # three messages. They collect here until the user stops sending.
    op.add_column(
        "conversations",
        sa.Column("media_buffer", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        schema=SCHEMA,
    )
    op.add_column(
        "conversations",
        sa.Column("media_buffer_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    # Meta's handle for the photo; the CDN URL expires but this does not.
    op.add_column(
        "inbound_messages",
        sa.Column("media_id", sa.String(128), nullable=True),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column("inbound_messages", "media_id", schema=SCHEMA)
    op.drop_column("conversations", "media_buffer_at", schema=SCHEMA)
    op.drop_column("conversations", "media_buffer", schema=SCHEMA)
