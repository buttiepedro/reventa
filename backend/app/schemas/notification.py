import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    body: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    is_read: bool
    created_at: datetime


class NotificationCount(BaseModel):
    unread: int


__all__ = ["NotificationRead", "NotificationCount"]
