"""Proactive messages: the agent starting a conversation instead of answering one.

Three gates stand between a Stockar event and someone's phone, and all three must
open: the template is on the enabled list, the user has not opted out, and Meta
will accept the message. Anything that does not go out is recorded with its reason.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.link import WhatsAppLink
from app.models.outbound import OutboundNotification
from app.services.meta import MetaClient
from app.services.templates import TEMPLATES

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def notify_users(
    session: AsyncSession,
    user_ids: list[uuid.UUID],
    template_name: str,
    params: dict,
) -> dict:
    """Deliver one notification to whichever of these users can and want to get it."""
    template = TEMPLATES.get(template_name)
    if template is None:
        return {"sent": 0, "skipped": len(user_ids), "reason": "unknown_template"}
    if template_name not in settings.enabled_notifications_list:
        # Not an error: this is the default state until the template is approved.
        return {"sent": 0, "skipped": len(user_ids), "reason": "template_not_enabled"}

    links = (
        await session.scalars(
            select(WhatsAppLink).where(
                WhatsAppLink.user_id.in_(user_ids),
                WhatsAppLink.verified_at.is_not(None),
                WhatsAppLink.revoked_at.is_(None),
                WhatsAppLink.notifications_enabled.is_(True),
            )
        )
    ).all()

    client = MetaClient()
    sent = 0
    for link in links:
        channel = "session" if await _within_window(session, link.phone_e164) else "template"
        if channel == "session":
            await client.send_text(link.phone_e164, template.render(params))
            ok, detail = True, ""
        else:
            ok, detail = await client.send_template(
                link.phone_e164,
                template.meta_name,
                settings.whatsapp_template_language,
                template.ordered(params),
            )
        sent += 1 if ok else 0
        session.add(
            OutboundNotification(
                user_id=link.user_id,
                phone_e164=link.phone_e164,
                template=template_name,
                channel=channel,
                status="sent" if ok else "failed",
                detail=detail or None,
            )
        )

    return {"sent": sent, "skipped": len(user_ids) - len(links), "reason": None}


async def _within_window(session: AsyncSession, phone_e164: str) -> bool:
    """Inside 24h of the user's last message, free text is allowed and costs nothing."""
    last = await session.scalar(
        select(Conversation.last_message_at).where(Conversation.phone_e164 == phone_e164)
    )
    if last is None:
        return False
    return last > _now() - timedelta(hours=settings.notification_window_hours)


async def set_enabled(session: AsyncSession, user_id: uuid.UUID, enabled: bool) -> None:
    links = await session.scalars(
        select(WhatsAppLink).where(
            WhatsAppLink.user_id == user_id,
            WhatsAppLink.verified_at.is_not(None),
            WhatsAppLink.revoked_at.is_(None),
        )
    )
    for link in links:
        link.notifications_enabled = enabled
