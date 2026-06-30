"""v2 foundation: company extension, vehicle extension, new tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-30
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── 1. Extend companies ─────────────────────────────────────────────────
    op.add_column("companies", sa.Column("cuit", sa.String(20), nullable=True))
    op.add_column("companies", sa.Column("verification_status", sa.String(20), nullable=False, server_default="approved"))
    op.add_column("companies", sa.Column("verification_notes", sa.Text, nullable=True))
    op.add_column("companies", sa.Column("logo_url", sa.String(500), nullable=True))
    op.add_column("companies", sa.Column("description", sa.Text, nullable=True))
    op.add_column("companies", sa.Column("phone", sa.String(30), nullable=True))
    op.add_column("companies", sa.Column("lat", sa.Numeric(10, 8), nullable=True))
    op.add_column("companies", sa.Column("lng", sa.Numeric(11, 8), nullable=True))
    op.add_column("companies", sa.Column("address_text", sa.String(500), nullable=True))
    op.add_column("companies", sa.Column("avg_rating", sa.Numeric(2, 1), nullable=True))
    op.add_column("companies", sa.Column("total_ratings", sa.Integer, nullable=False, server_default="0"))

    # ─── 2. Extend vehicles ───────────────────────────────────────────────────
    op.add_column("vehicles", sa.Column("plate", sa.String(20), nullable=True))
    op.add_column("vehicles", sa.Column("has_service_history", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("vehicles", sa.Column("aesthetic_condition", sa.String(10), nullable=False, server_default="good"))
    op.add_column("vehicles", sa.Column("pre_toma_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_vehicles_plate", "vehicles", ["plate"])

    # ─── 3. Liquidaciones ─────────────────────────────────────────────────────
    op.create_table(
        "liquidaciones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("liquidation_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("reference_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_liquidaciones_status_expires", "liquidaciones", ["status", "expires_at"])
    op.create_index("ix_liquidaciones_vehicle_id", "liquidaciones", ["vehicle_id"])

    # ─── 4. Radar entries ─────────────────────────────────────────────────────
    op.create_table(
        "radar_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("brand", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("max_km", sa.Integer, nullable=True),
        sa.Column("min_year", sa.Integer, nullable=True),
        sa.Column("max_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ─── 5. Company ratings ───────────────────────────────────────────────────
    op.create_table(
        "company_ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rater_company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rated_company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("rating", sa.SmallInteger, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("entity_type", sa.String(30), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_company_ratings_rater_entity",
        "company_ratings",
        ["rater_company_id", "entity_type", "entity_id"],
    )

    # ─── 6. Client requests (La Lonja) ────────────────────────────────────────
    op.create_table(
        "client_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("budget_min", sa.Numeric(12, 2), nullable=True),
        sa.Column("budget_max", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_method", sa.String(20), nullable=False, server_default="any"),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("reference_models", postgresql.ARRAY(sa.Text), nullable=True),
        sa.Column("filters", postgresql.JSONB, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_client_requests_status_expires", "client_requests", ["status", "expires_at"])

    # ─── 7. Stock offers (La Lonja) ───────────────────────────────────────────
    op.create_table(
        "stock_offers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_requests.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("offering_company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("rank_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_stock_offers_request_vehicle",
        "stock_offers",
        ["client_request_id", "vehicle_id"],
    )

    # ─── 8. Direct matches (La Lonja) ─────────────────────────────────────────
    op.create_table(
        "direct_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("client_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notified_company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("vehicle_company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_direct_matches_request_vehicle",
        "direct_matches",
        ["client_request_id", "vehicle_id"],
    )

    # ─── 9. Scraper cache (Tasador) ───────────────────────────────────────────
    op.create_table(
        "scraper_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cache_key", sa.String(200), unique=True, nullable=False),
        sa.Column("prices", postgresql.JSONB, nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ─── 10. Audience PIN on users ────────────────────────────────────────────
    op.add_column("users", sa.Column("audience_pin_hash", sa.String(60), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "audience_pin_hash")
    op.drop_table("scraper_cache")
    op.drop_table("direct_matches")
    op.drop_table("stock_offers")
    op.drop_table("client_requests")
    op.drop_table("company_ratings")
    op.drop_table("radar_entries")
    op.drop_table("liquidaciones")
    op.drop_index("ix_vehicles_plate", "vehicles")
    op.drop_column("vehicles", "pre_toma_expires_at")
    op.drop_column("vehicles", "aesthetic_condition")
    op.drop_column("vehicles", "has_service_history")
    op.drop_column("vehicles", "plate")
    op.drop_column("companies", "total_ratings")
    op.drop_column("companies", "avg_rating")
    op.drop_column("companies", "address_text")
    op.drop_column("companies", "lng")
    op.drop_column("companies", "lat")
    op.drop_column("companies", "phone")
    op.drop_column("companies", "description")
    op.drop_column("companies", "logo_url")
    op.drop_column("companies", "verification_notes")
    op.drop_column("companies", "verification_status")
    op.drop_column("companies", "cuit")
