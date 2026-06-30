import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class CompanyCreate(BaseModel):
    name: str
    slug: str

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        import re
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Slug may only contain lowercase letters, digits, and hyphens")
        return v


class CompanyUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class CompanyRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime


class CompanyProfile(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    slug: str
    is_active: bool
    cuit: str | None
    verification_status: str
    logo_url: str | None
    description: str | None
    phone: str | None
    lat: Decimal | None
    lng: Decimal | None
    address_text: str | None
    avg_rating: Decimal | None
    total_ratings: int
    created_at: datetime


class CompanyProfileUpdate(BaseModel):
    name: str | None = None
    cuit: str | None = None
    phone: str | None = None
    description: str | None = None
    address_text: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    logo_url: str | None = None


class RadarEntryCreate(BaseModel):
    brand: str
    model: str | None = None
    category: str | None = None
    max_km: int | None = None
    min_year: int | None = None
    max_price: Decimal | None = None


class RadarEntryRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    brand: str
    model: str | None
    category: str | None
    max_km: int | None
    min_year: int | None
    max_price: Decimal | None
    created_at: datetime
