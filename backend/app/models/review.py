"""
Review Model — Google review requests and tracking
"""
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class Review(BaseModel):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True)
    review_url: Mapped[str | None]
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(default="requested")
    requested_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    published_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    def __repr__(self):
        return f"<Review(id={self.id}, status={self.status}, rating={self.rating})>"