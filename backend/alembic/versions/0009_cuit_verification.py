"""cuit verification and logo s3 key on companies

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-29
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("cuit_verified", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("companies", sa.Column("cuit_submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("companies", sa.Column("cuit_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("companies", sa.Column("cuit_reviewer_id", UUID(as_uuid=True), nullable=True))
    op.add_column("companies", sa.Column("cuit_review_notes", sa.Text, nullable=True))
    op.add_column("companies", sa.Column("logo_s3_key", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "logo_s3_key")
    op.drop_column("companies", "cuit_review_notes")
    op.drop_column("companies", "cuit_reviewer_id")
    op.drop_column("companies", "cuit_reviewed_at")
    op.drop_column("companies", "cuit_submitted_at")
    op.drop_column("companies", "cuit_verified")
