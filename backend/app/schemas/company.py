import re
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
    cuit_verified: bool
    cuit_submitted_at: datetime | None
    cuit_review_notes: str | None
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
    phone: str | None = None
    description: str | None = None
    address_text: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None


def _validate_cuit_digits(cuit: str) -> bool:
    digits = re.sub(r"[^0-9]", "", cuit)
    if len(digits) != 11:
        return False
    weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(d) * w for d, w in zip(digits[:10], weights))
    remainder = total % 11
    verifier = 0 if remainder == 0 else (9 if remainder == 1 else 11 - remainder)
    return int(digits[-1]) == verifier


class CuitSubmit(BaseModel):
    cuit: str

    @field_validator("cuit")
    @classmethod
    def validate_cuit(cls, v: str) -> str:
        if not _validate_cuit_digits(v):
            raise ValueError("CUIT inválido. Verificá el formato y el dígito verificador.")
        return v


class VerifyCuitRequest(BaseModel):
    approved: bool
    reason: str | None = None


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
