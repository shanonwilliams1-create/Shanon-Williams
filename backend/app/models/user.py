"""
User Model — LeadForge contractor/tradesperson account
"""
import uuid
from datetime import datetime
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(unique=True, index=True)
    password_hash: Mapped[str]
    full_name: Mapped[str]
    trade: Mapped[str | None]
    service_area_radius: Mapped[str | None]
    service_lat: Mapped[str | None]
    service_lng: Mapped[str | None]
    subscription_tier: Mapped[str] = mapped_column(default="starter")
    stripe_customer_id: Mapped[str | None]
    stripe_subscription_id: Mapped[str | None]
    is_active: Mapped[bool] = mapped_column(default=True)
    settings: Mapped[dict | None] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, tier={self.subscription_tier})>"