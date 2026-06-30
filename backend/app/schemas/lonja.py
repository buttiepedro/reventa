import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ClientRequestCreate(BaseModel):
    budget_max: Decimal
    budget_min: Decimal | None = None
    payment_method: str = "any"
    category: str | None = None
    reference_models: list[str] | None = None
    notes: str | None = None


class ClientRequestRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    company_id: uuid.UUID
    company_name: str
    budget_min: Decimal | None
    budget_max: Decimal
    payment_method: str
    category: str | None
    reference_models: list[str] | None
    status: str
    expires_at: datetime
    created_at: datetime
    offer_count: int = 0


class StockOfferCreate(BaseModel):
    vehicle_id: uuid.UUID
    message: str | None = None


class StockOfferRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    client_request_id: uuid.UUID
    offering_company_id: uuid.UUID
    offering_company_name: str
    vehicle_id: uuid.UUID
    vehicle_label: str
    vehicle_price: Decimal
    message: str | None
    status: str
    rank_score: Decimal | None
    created_at: datetime
