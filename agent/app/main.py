import subprocess
import sys
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI, Response, status
from sqlalchemy import select

from app.api import internal, webhook
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.inbound import InboundMessage


def _run_migrations() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd="/app",
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Agent migrations failed (exit {result.returncode}):\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )
    print("Agent migrations complete.", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    await asyncio.to_thread(_run_migrations)
    app.state.queue = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    yield
    await app.state.queue.aclose()


app = FastAPI(
    title="Reventa WhatsApp Agent",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url=None,
)

app.include_router(webhook.router, prefix="/webhook", tags=["webhook"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])


@app.get("/health")
async def health(response: Response) -> dict:
    """Ready means: migrations applied and the tables answer."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(select(InboundMessage.id).limit(1))
    except Exception as exc:  # noqa: BLE001
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "detail": str(exc)[:200]}
    return {"status": "ok"}
