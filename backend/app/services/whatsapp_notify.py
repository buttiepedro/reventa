"""Fan a Stockar event out to the WhatsApp agent.

Push notifications are company-scoped; WhatsApp links are personal. The mapping
from one to the other lives here, because the agent has no access to Stockar's
users and should not.

Nothing in here may break the request that triggered it: a notification that
cannot be delivered is logged and dropped.
"""

import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

_TIMEOUT = 5.0


async def notify_whatsapp(
    session: AsyncSession,
    company_ids: uuid.UUID | list[uuid.UUID],
    template: str,
    params: dict,
) -> None:
    """Notify every linked user of these companies with a single call.

    Takes a list because the network-wide events (a new pre-toma) touch every
    company at once, and one round trip per company would be one per agency.
    """
    if not settings.agent_service_key or not settings.agent_base_url:
        return

    ids = [company_ids] if isinstance(company_ids, uuid.UUID) else list(company_ids)
    if not ids:
        return

    user_ids = (
        await session.scalars(
            select(User.id).where(User.company_id.in_(ids), User.is_active.is_(True))
        )
    ).all()
    if not user_ids:
        return

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.post(
                f"{settings.agent_base_url.rstrip('/')}/internal/notify",
                headers={"X-Service-Key": settings.agent_service_key},
                json={
                    "user_ids": [str(uid) for uid in user_ids],
                    "template": template,
                    "params": params,
                },
            )
    except httpx.HTTPError as exc:
        logger.warning("WhatsApp notification (%s) not delivered: %s", template, exc)
