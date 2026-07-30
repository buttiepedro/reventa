import asyncio
import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import update

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.seed import seed_super_admin
from app.models.client_request import ClientRequest
from app.services.vehicle import VehicleService


def _run_migrations() -> None:
    print(f"Running migrations against: {settings.db_url.split('@')[-1]}", flush=True)
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd="/app",
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Migrations failed (exit {result.returncode}):\n"
            f"STDOUT: {result.stdout}\n"
            f"STDERR: {result.stderr}"
        )
    if result.stdout:
        print(result.stdout, flush=True)
    print("Migrations complete.", flush=True)


async def _lonja_expiry_loop() -> None:
    while True:
        await asyncio.sleep(6 * 3600)  # every 6 hours
        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    update(ClientRequest)
                    .where(
                        ClientRequest.status == "active",
                        ClientRequest.expires_at <= __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
                    )
                    .values(status="expired")
                    .returning(ClientRequest.id)
                )
                expired = len(result.fetchall())
                await session.commit()
                if expired:
                    print(f"[scheduler] Expired {expired} Lonja request(s).", flush=True)
        except Exception as exc:
            print(f"[scheduler] Lonja expiry error: {exc}", flush=True)


async def _pretoma_expiry_loop() -> None:
    while True:
        await asyncio.sleep(3600)  # every hour
        try:
            async with AsyncSessionLocal() as session:
                expired = await VehicleService.expire_pretoma_ttl(session)
                if expired:
                    print(f"[scheduler] Expired {expired} pre-toma vehicle(s).", flush=True)
        except Exception as exc:
            print(f"[scheduler] Pre-toma expiry error: {exc}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(_run_migrations)
    await seed_super_admin()
    task_pretoma = asyncio.create_task(_pretoma_expiry_loop())
    task_lonja = asyncio.create_task(_lonja_expiry_loop())
    yield
    task_pretoma.cancel()
    task_lonja.cancel()
    for t in (task_pretoma, task_lonja):
        try:
            await t
        except asyncio.CancelledError:
            pass


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
