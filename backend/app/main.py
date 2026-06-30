"""
LeadForge — FastAPI Application Entry Point
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import engine, BaseModel
from app.routers import auth, users, leads, outreach, appointments, followups, reviews, referrals

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

# ── API Routers ──────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(outreach.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(followups.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(referrals.router, prefix="/api")


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