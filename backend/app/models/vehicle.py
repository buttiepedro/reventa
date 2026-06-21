import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FuelType(str, PyEnum):
    GASOLINE = "gasoline"
    DIESEL = "diesel"
    ELECTRIC = "electric"
    HYBRID = "hybrid"
    GNC = "gnc"


class Transmission(str, PyEnum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"


class VehicleCondition(str, PyEnum):
    NEW = "new"
    USED = "used"


class VehicleStatus(str, PyEnum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    SOLD = "sold"
    PRE_TOMA = "pre_toma"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str] = mapped_column(String(50), nullable=False)
    mileage: Mapped[int] = mapped_column(Integer, nullable=False)
    fuel_type: Mapped[FuelType] = mapped_column(Enum(FuelType, name="fueltype", values_callable=lambda x: [e.value for e in x]), nullable=False)
    transmission: Mapped[Transmission] = mapped_column(Enum(Transmission, name="transmission", values_callable=lambda x: [e.value for e in x]), nullable=False)
    condition: Mapped[VehicleCondition] = mapped_column(Enum(VehicleCondition, name="vehiclecondition", values_callable=lambda x: [e.value for e in x]), nullable=False)
    body_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    price_resale: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    price_public: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus, name="vehiclestatus", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=VehicleStatus.AVAILABLE,
    )
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    share_token: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, default=uuid.uuid4, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company: Mapped["Company"] = relationship("Company", lazy="select")
    images: Mapped[list["VehicleImage"]] = relationship(
        "VehicleImage", back_populates="vehicle", lazy="select", order_by="VehicleImage.display_order"
    )
