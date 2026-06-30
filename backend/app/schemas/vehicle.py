import uuid
from datetime import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, field_validator

from app.models.vehicle import FuelType, Transmission, VehicleCondition, VehicleStatus
from app.schemas.vehicle_image import VehicleImageRead

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class VehicleCreate(BaseModel):
    brand: str
    model: str
    year: int
    version: str | None = None
    color: str
    mileage: int
    fuel_type: FuelType
    transmission: Transmission
    condition: VehicleCondition
    body_type: str | None = None
    plate: str | None = None
    price_resale: Decimal
    price_public: Decimal
    description: str | None = None
    status: VehicleStatus = VehicleStatus.AVAILABLE

    @field_validator("year")
    @classmethod
    def valid_year(cls, v: int) -> int:
        if v < 1900 or v > 2100:
            raise ValueError("Year out of range")
        return v

    @field_validator("mileage")
    @classmethod
    def non_negative_mileage(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Mileage cannot be negative")
        return v


class VehicleUpdate(BaseModel):
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    version: str | None = None
    color: str | None = None
    mileage: int | None = None
    fuel_type: FuelType | None = None
    transmission: Transmission | None = None
    condition: VehicleCondition | None = None
    body_type: str | None = None
    plate: str | None = None
    price_resale: Decimal | None = None
    price_public: Decimal | None = None
    description: str | None = None
    status: VehicleStatus | None = None


class VehicleStatusUpdate(BaseModel):
    status: VehicleStatus


class VehicleFilters(BaseModel):
    brand: str | None = None
    model: str | None = None
    year_min: int | None = None
    year_max: int | None = None
    fuel_type: FuelType | None = None
    transmission: Transmission | None = None
    condition: VehicleCondition | None = None
    status: VehicleStatus | None = VehicleStatus.AVAILABLE
    company_id: uuid.UUID | None = None
    page: int = 1
    page_size: int = 20


class VehicleRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    company_name: str
    brand: str
    model: str
    year: int
    version: str | None
    color: str
    mileage: int
    fuel_type: FuelType
    transmission: Transmission
    condition: VehicleCondition
    body_type: str | None
    plate: str | None = None
    price_resale: Decimal
    price_public: Decimal
    description: str | None
    status: VehicleStatus
    share_token: uuid.UUID
    images: list[VehicleImageRead]
    is_favorite_company: bool = False
    created_at: datetime


class VehicleListItem(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    company_name: str
    brand: str
    model: str
    year: int
    version: str | None
    color: str
    mileage: int
    fuel_type: FuelType
    transmission: Transmission
    condition: VehicleCondition
    price_resale: Decimal
    price_public: Decimal
    status: VehicleStatus
    primary_image_url: str | None = None
    is_favorite_company: bool = False
    created_at: datetime


class VehiclePublic(BaseModel):
    """Returned for shareable links — no prices, no company info."""

    model_config = {"from_attributes": True}

    brand: str
    model: str
    year: int
    version: str | None
    color: str
    mileage: int
    fuel_type: FuelType
    transmission: Transmission
    condition: VehicleCondition
    body_type: str | None
    description: str | None
    images: list[VehicleImageRead]
