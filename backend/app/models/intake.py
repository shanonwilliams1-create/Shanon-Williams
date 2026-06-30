"""
IntakeLead — Client intake session captured via chat widget or phone call
"""
import uuid
from datetime import datetime
from sqlalchemy import JSON, Float, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import BaseModel


class IntakeLead(BaseModel):
    __tablename__ = "intake_leads"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(unique=True, index=True,
                                             default=lambda: str(uuid.uuid4()))
    intake_source: Mapped[str] = mapped_column(default="chat")  # chat | phone | form

    # Chat / voice state machine
    chat_state: Mapped[str] = mapped_column(default="greeting")

    # Client contact info
    client_name: Mapped[str | None]
    client_phone: Mapped[str | None]
    client_email: Mapped[str | None]

    # Case details
    case_type: Mapped[str | None]           # personal_injury | criminal | family | etc.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    urgency_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    urgency_indicators: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Scoring
    lead_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_hot: Mapped[bool] = mapped_column(Boolean, default=False)
    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False)

    # Notification tracking
    attorney_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    notified_at: Mapped[datetime | None]

    # Full transcript / chat history [{role, content, ts}]
    chat_history: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Lead lifecycle status
    status: Mapped[str] = mapped_column(default="chatting")
    # chatting | complete | contacted | rejected

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow,
                                                  onupdate=datetime.utcnow)

    def __repr__(self):
        return (f"<IntakeLead(id={self.id}, name={self.client_name}, "
                f"hot={self.is_hot}, urgent={self.is_urgent})>")
