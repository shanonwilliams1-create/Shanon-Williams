"""
ScrapingSource & ScrapingLog Models — Data source configuration and scrape history
"""
import uuid
from datetime import datetime
from sqlalchemy import JSON, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class ScrapingSource(BaseModel):
    __tablename__ = "scraping_sources"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str]
    type: Mapped[str]  # facebook, job_board, classifieds, newspaper, permit, property_record
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    last_scraped_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ScrapingSource(id={self.id}, name={self.name}, type={self.type})>"


class ScrapingLog(BaseModel):
    __tablename__ = "scraping_logs"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id: Mapped[str]
    status: Mapped[str]  # ScrapeStatus enum
    leads_found: Mapped[int] = mapped_column(Integer, default=0)
    leads_new: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_output: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ran_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    def __repr__(self):
        return f"<ScrapingLog(id={self.id}, source={self.source_id}, status={self.status})>"