import asyncio
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.seed import seed_super_admin


def _run_migrations() -> None:
    import logging
    logger = logging.getLogger("alembic.runtime.migration")
    logger.info("Running database migrations...")
    alembic_cfg = Config("/app/alembic.ini")
    command.upgrade(alembic_cfg, "head")
    logger.info("Migrations complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await asyncio.wait_for(asyncio.to_thread(_run_migrations), timeout=60)
    except asyncio.TimeoutError:
        raise RuntimeError("Database migrations timed out — check DATABASE_URL and DB connectivity")
    except Exception as exc:
        raise RuntimeError(f"Database migrations failed: {exc}") from exc
    await seed_super_admin()
    yield


app = FastAPI(
    title="Reventa API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
