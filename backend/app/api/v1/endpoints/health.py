from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session

router = APIRouter()


@router.get("")
async def health_check(db: AsyncSession = Depends(get_session)) -> dict:
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
