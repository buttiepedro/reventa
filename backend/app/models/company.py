import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Identity & verification
    cuit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(20), nullable=False, default="approved")
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Geolocation
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8), nullable=True)
    lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8), nullable=True)
    address_text: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Reputation
    avg_rating: Mapped[Decimal | None] = mapped_column(Numeric(2, 1), nullable=True)
    total_ratings: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users: Mapped[list["User"]] = relationship("User", back_populates="company", lazy="select")
