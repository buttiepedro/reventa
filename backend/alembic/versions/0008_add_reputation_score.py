"""Add reputation_score to companies

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-29
"""
import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("reputation_score", sa.SmallInteger, nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "reputation_score")
