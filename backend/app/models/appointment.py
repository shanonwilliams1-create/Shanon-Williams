"""
Appointment Model — Scheduled site visits / consultations
"""
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class Appointment(BaseModel):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    start_time: Mapped[datetime]
    end_time: Mapped[datetime]
    status: Mapped[str] = mapped_column(default="scheduled")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_calendar_event_id: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Appointment(id={self.id}, lead={self.lead_id}, status={self.status})>"