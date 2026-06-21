"""
Outreach Model — Track email/SMS/call communications sent to leads
"""
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel
from app.models import OutreachChannel, OutreachDirection, OutreachStatus


class Outreach(BaseModel):
    __tablename__ = "outreach"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    channel: Mapped[str]  # OutreachChannel enum value
    direction: Mapped[str] = mapped_column(default="outbound")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(default="pending")
    scheduled_at: Mapped[datetime | None]
    sent_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    def __repr__(self):
        return f"<Outreach(id={self.id}, channel={self.channel}, status={self.status})>"