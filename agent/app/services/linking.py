"""Binding a phone number to a Stockar user.

The code travels app -> phone: the user reads it while authenticated and sends it
from the handset, which proves control of both sides. A code that travelled the
other way would only prove control of the phone.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.link import WhatsAppLink

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def is_code(text: str) -> bool:
    return text.strip().isdigit() and len(text.strip()) == 6


async def start_link(session: AsyncSession, user_id: uuid.UUID) -> tuple[str, datetime]:
    """Issue a fresh code, replacing any pending attempt for this user."""
    pending = await session.scalars(
        select(WhatsAppLink).where(
            WhatsAppLink.user_id == user_id,
            WhatsAppLink.verified_at.is_(None),
            WhatsAppLink.revoked_at.is_(None),
        )
    )
    for row in pending:
        row.revoked_at = _now()

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = _now() + timedelta(minutes=settings.link_code_ttl_minutes)
    session.add(
        WhatsAppLink(
            user_id=user_id,
            code_hash=_pwd_context.hash(code),
            code_expires_at=expires_at,
            attempts=0,
        )
    )
    await session.flush()
    return code, expires_at


async def resolve(session: AsyncSession, phone_e164: str) -> WhatsAppLink | None:
    return await session.scalar(
        select(WhatsAppLink).where(
            WhatsAppLink.phone_e164 == phone_e164,
            WhatsAppLink.verified_at.is_not(None),
            WhatsAppLink.revoked_at.is_(None),
        )
    )


async def try_verify(session: AsyncSession, phone_e164: str, code: str) -> WhatsAppLink | None:
    """Match a 6-digit code against the live pending links.

    Returns None for every failure mode — expired, wrong, exhausted, already taken —
    so the reply can stay uniform and reveal nothing about who is registered.
    """
    if await resolve(session, phone_e164):
        return None

    candidates = await session.scalars(
        select(WhatsAppLink).where(
            WhatsAppLink.verified_at.is_(None),
            WhatsAppLink.revoked_at.is_(None),
            WhatsAppLink.code_hash.is_not(None),
            WhatsAppLink.code_expires_at > _now(),
            WhatsAppLink.attempts < settings.link_code_max_attempts,
        )
    )
    for link in candidates:
        link.attempts += 1
        if not _pwd_context.verify(code, link.code_hash or ""):
            continue
        if link.attempts > settings.link_code_max_attempts:
            link.revoked_at = _now()
            return None
        link.phone_e164 = phone_e164
        link.verified_at = _now()
        link.code_hash = None
        link.code_expires_at = None
        await session.flush()
        return link
    return None


async def status(session: AsyncSession, user_id: uuid.UUID) -> dict:
    link = await session.scalar(
        select(WhatsAppLink).where(
            WhatsAppLink.user_id == user_id,
            WhatsAppLink.verified_at.is_not(None),
            WhatsAppLink.revoked_at.is_(None),
        )
    )
    if not link or not link.phone_e164:
        return {
            "linked": False,
            "phone_masked": None,
            "verified_at": None,
            "notifications_enabled": False,
        }
    return {
        "linked": True,
        "phone_masked": f"{link.phone_e164[:4]}•••{link.phone_e164[-3:]}",
        "verified_at": link.verified_at.isoformat() if link.verified_at else None,
        "notifications_enabled": link.notifications_enabled,
    }


async def revoke(session: AsyncSession, user_id: uuid.UUID) -> None:
    links = await session.scalars(
        select(WhatsAppLink).where(
            WhatsAppLink.user_id == user_id,
            WhatsAppLink.revoked_at.is_(None),
        )
    )
    for link in links:
        link.revoked_at = _now()
