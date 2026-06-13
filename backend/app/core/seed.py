import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password

logger = logging.getLogger(__name__)


async def seed_super_admin() -> None:
    from app.models.user import Role, User  # late import to avoid circular deps at module load

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.role == Role.SUPER_ADMIN))
        if result.scalar_one_or_none() is not None:
            return

        admin = User(
            email=settings.admin_email,
            hashed_password=hash_password(settings.admin_password),
            full_name=settings.admin_name,
            role=Role.SUPER_ADMIN,
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        logger.info("Super admin seeded: %s", settings.admin_email)
