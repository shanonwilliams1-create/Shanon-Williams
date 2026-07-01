"""
LeadForge — FastAPI Application Entry Point
"""
import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, BaseModel
from app.routers import auth, users, leads, outreach, appointments, followups, reviews, referrals
from app.routers import intake

logger = logging.getLogger("leadforge")

APP_NAME = "LeadForge API"
APP_VERSION = "0.1.0"
APP_DESCRIPTION = "Lead generation engine for contractors and tradespeople"

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "../../frontend/dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup/shutdown logic."""
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)

    # Start background scraper worker
    scraper_task = None
    try:
        from app.scraper_worker import scraper_loop
        shutdown_event = asyncio.Event()
        scraper_task = asyncio.create_task(scraper_loop(shutdown_event))
        logger.info("Background scraper worker started")
    except Exception as e:
        logger.warning(f"Could not start scraper worker: {e}")

    yield

    # Shutdown: cancel scraper worker
    if scraper_task:
        shutdown_event.set()
        scraper_task.cancel()
        try:
            await asyncio.wait_for(scraper_task, timeout=10.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
        logger.info("Background scraper worker stopped")

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

# ── API Routers ──────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(outreach.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(followups.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(referrals.router, prefix="/api")
app.include_router(intake.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "environment": settings.environment,
    }


# ── Static Files (Serves Built Frontend) ────────────────────────────
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve the frontend SPA for all non-API routes."""
        file_path = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(file_path):
            return FileResponse(file_path)
        return {"error": "Frontend not built yet. Run: cd frontend && npm run build"}