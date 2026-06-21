"""
SubscriptionPlan Model — Stripe subscription plan definitions
"""
import uuid
from datetime import datetime
from sqlalchemy import JSON, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class SubscriptionPlan(BaseModel):
    __tablename__ = "subscription_plans"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    stripe_price_id: Mapped[str]
    name: Mapped[str]  # starter, pro, elite
    description: Mapped[str | None]
    price_monthly: Mapped[float] = mapped_column(Float)
    lead_limit: Mapped[str | None]
    features: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SubscriptionPlan(id={self.id}, name={self.name}, price={self.price_monthly})>"