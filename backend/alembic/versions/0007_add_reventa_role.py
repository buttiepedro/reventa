"""Add reventa role to userrole enum

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-29
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'reventa'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values — intentional no-op
    pass
