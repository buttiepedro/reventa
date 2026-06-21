import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.company import CompanyRead

FavoriteRead = CompanyRead


class FavoriteRequestRead(BaseModel):
    model_config = {"from_attributes": True}

    requester_id: uuid.UUID
    requester_name: str
    created_at: datetime


class FavoriteStatusRead(BaseModel):
    """Status of the relationship between current company and another company."""
    company_id: uuid.UUID
    status: str | None  # None = no relation, "pending_sent", "pending_received", "accepted"


__all__ = ["FavoriteRead", "FavoriteRequestRead", "FavoriteStatusRead"]
