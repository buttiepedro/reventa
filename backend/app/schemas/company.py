import uuid
from datetime import datetime

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
