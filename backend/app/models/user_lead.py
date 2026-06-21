"""
UserLead Junction Model — Associates a lead with a user (contractor's lead inbox)
"""
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import BaseModel
from app.models import LeadStatus


class UserLead(BaseModel):
    __tablename__ = "user_leads"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    status: Mapped[str] = mapped_column(default="new")
    assigned_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    outreach_count: Mapped[int] = mapped_column(Integer, default=0)
    last_outreach_at: Mapped[datetime | None]
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="lead_assignments")
    lead = relationship("Lead", back_populates="user_links")

    def __repr__(self):
        return f"<UserLead(user={self.user_id}, lead={self.lead_id}, status={self.status})>"