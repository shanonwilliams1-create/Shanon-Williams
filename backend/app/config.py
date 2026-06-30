"""
LeadForge — Application Configuration
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── App ──────────────────────────────────────────────────────────
    environment: str = "development"
    debug: bool = True
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── Database ─────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./leadforge.db"

    @field_validator("database_url", mode="before")
    @classmethod
    def coerce_db_url(cls, v: str) -> str:
        """Railway injects postgres:// or postgresql:// — rewrite for asyncpg."""
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://") and "+asyncpg" not in v:
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # ── Auth / JWT ───────────────────────────────────────────────────
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── Stripe ───────────────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # ── Email (SendGrid) ─────────────────────────────────────────────
    sendgrid_api_key: str = ""
    from_email: str = "noreply@leadforge.app"

    # ── SMS (Twilio) ─────────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # ── Google Calendar ──────────────────────────────────────────────
    google_credentials_path: str = ""
    google_calendar_id: str = "primary"

    # ── Attorney / Firm (intake notifications) ───────────────────────
    attorney_phone: str = ""      # E.164 format, e.g. +15551234567
    attorney_email: str = ""
    firm_name: str = "Our Law Firm"

    # ── Rate limiting ────────────────────────────────────────────────
    rate_limit_per_minute: int = 100

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()