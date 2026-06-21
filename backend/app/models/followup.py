"""
FollowUp Model — Automated post-job follow-ups (thank you, review requests, etc.)
"""
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class FollowUp(BaseModel):
    __tablename__ = "follow_ups"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    type: Mapped[str]  # FollowUpType enum
    scheduled_for: Mapped[datetime | None]
    status: Mapped[str] = mapped_column(default="pending")
    content_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    def __repr__(self):
        return f"<FollowUp(id={self.id}, type={self.type}, status={self.status})>"