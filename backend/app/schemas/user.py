import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import Role


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Role = Role.COMPANY_USER


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None


class UserRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    company_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
