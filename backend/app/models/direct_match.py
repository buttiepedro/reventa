import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DirectMatch(Base):
    __tablename__ = "direct_matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("client_requests.id", ondelete="CASCADE"), nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    notified_company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client_request: Mapped["ClientRequest"] = relationship("ClientRequest", lazy="select")
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", lazy="select")
    notified_company: Mapped["Company"] = relationship("Company", foreign_keys=[notified_company_id], lazy="select")
    vehicle_company: Mapped["Company"] = relationship("Company", foreign_keys=[vehicle_company_id], lazy="select")
