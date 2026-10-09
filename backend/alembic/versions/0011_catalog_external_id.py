"""rename carapi_id to external_id on catalog tables

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-09
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

TABLES = ("vehicle_makes", "vehicle_models", "vehicle_trims")


def upgrade() -> None:
    # El catálogo ya no viene de carapi sino de Mercado Libre, y los ids de MELI
    # son cadenas. Se renombra en las tres tablas para no dejar media mitad del
    # esquema nombrada por un proveedor que ya no se usa.
    for table in TABLES:
        op.alter_column(
            table,
            "carapi_id",
            new_column_name="external_id",
            type_=sa.String(40),
            existing_type=sa.Integer(),
            postgresql_using="carapi_id::varchar",
        )


def downgrade() -> None:
    for table in TABLES:
        op.alter_column(
            table,
            "external_id",
            new_column_name="carapi_id",
            type_=sa.Integer(),
            existing_type=sa.String(40),
            postgresql_using="external_id::integer",
        )
