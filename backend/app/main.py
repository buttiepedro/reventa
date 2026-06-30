import asyncio
import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.seed import seed_super_admin
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
    task = asyncio.create_task(_pretoma_expiry_loop())
    yield
    task.cancel()
    try:
        await task
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
