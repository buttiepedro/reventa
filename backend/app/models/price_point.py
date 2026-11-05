import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VehiclePricePoint(Base):
    """Un precio observado para un modelo, en un momento.

    Los datos del vehículo se copian en vez de referenciarse: un auto se edita,
    se borra o cambia de precio, y el historial tiene que seguir diciendo qué
    valía ese Corolla 2019 de 80.000 km el día que se publicó.
    """

    __tablename__ = "vehicle_price_points"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Copia del vehículo al momento del registro.
    brand: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mileage: Mapped[int] = mapped_column(Integer, nullable=False)

    # publicado · vendido · liquidado
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    price_resale: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    price_public: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
