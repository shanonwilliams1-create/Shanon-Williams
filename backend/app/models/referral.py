"""
Referral Model — Referral program tracking
"""
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class Referral(BaseModel):
    __tablename__ = "referrals"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    referrer_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    referred_email: Mapped[str]
    referred_name: Mapped[str | None]
    referred_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(default="sent")
    reward_status: Mapped[str] = mapped_column(default="pending")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    converted_at: Mapped[datetime | None]

    def __repr__(self):
        return f"<Referral(id={self.id}, email={self.referred_email}, status={self.status})>"