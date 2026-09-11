import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Conversation(Base):
    """Rolling state for one phone number: history, pending write, daily budget."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_e164: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    messages: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    pending_action: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    pending_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    media_buffer: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    media_buffer_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    messages_today: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
