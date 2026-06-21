"""
Lead Model — A construction/renovation project discovered from external sources
"""
import uuid
from datetime import datetime
from sqlalchemy import JSON, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import BaseModel
from app.models import LeadSource, LeadStatus


class Lead(BaseModel):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    source: Mapped[str]  # LeadSource enum value
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_id: Mapped[str | None]
    project_title: Mapped[str | None]
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str | None]
    contact_email: Mapped[str | None]
    contact_phone: Mapped[str | None]
    address_street: Mapped[str | None]
    address_city: Mapped[str | None]
    address_state: Mapped[str | None]
    address_zip: Mapped[str | None]
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    trade_category: Mapped[str | None]
    budget_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    project_timeline: Mapped[str | None]
    status: Mapped[str] = mapped_column(default="new")
    lead_score: Mapped[float | None] = mapped_column(Float, default=0.0)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    discovered_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user_links = relationship("UserLead", back_populates="lead")

    def __repr__(self):
        return f"<Lead(id={self.id}, title={self.project_title}, source={self.source})>"