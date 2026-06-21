"""
LeadForge — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, BaseModel
from app.routers import auth, users, leads

APP_NAME = "LeadForge API"
APP_VERSION = "0.1.0"
APP_DESCRIPTION = "Lead generation engine for contractors and tradespeople"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup/shutdown logic."""
    # Startup: create tables in dev mode
    if settings.environment == "development":
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(leads.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "environment": settings.environment,
    }