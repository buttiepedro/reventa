import uuid
from datetime import datetime

from pydantic import BaseModel


class MakeRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    is_custom: bool


class MakeWrite(BaseModel):
    name: str


class ModelRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    make_id: uuid.UUID
    name: str
    is_custom: bool


class ModelWrite(BaseModel):
    make_id: uuid.UUID
    name: str


class TrimRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    model_id: uuid.UUID
    name: str
    is_custom: bool


class TrimWrite(BaseModel):
    model_id: uuid.UUID
    name: str


class SyncStatus(BaseModel):
    makes: int = 0
    models: int = 0
    trims: int = 0
    errors: list[str] = []
    last_run_at: datetime | None = None
    running: bool = False
