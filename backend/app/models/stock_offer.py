import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StockOffer(Base):
    __tablename__ = "stock_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("client_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    offering_company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    rank_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client_request: Mapped["ClientRequest"] = relationship("ClientRequest", lazy="select")
    offering_company: Mapped["Company"] = relationship("Company", lazy="select")
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", lazy="select")
