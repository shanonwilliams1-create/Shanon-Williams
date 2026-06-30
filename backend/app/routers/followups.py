"""
FollowUps Router — Mock API for automated post-job follow-ups
"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/followups", tags=["followups"])

mock_followups = [
    {"id": "fu-1", "lead_id": "lead-1", "type": "thank_you",
     "status": "pending", "content_template": "Thanks for choosing us! We hope you love your new kitchen.",
     "scheduled_for": "2026-07-05T10:00:00Z"},
    {"id": "fu-2", "lead_id": "lead-2", "type": "review_request",
     "status": "sent", "content_template": "Mind leaving us a quick review? Your feedback helps us grow!",
     "scheduled_for": "2026-06-25T14:00:00Z"},
    {"id": "fu-3", "lead_id": "lead-4", "type": "referral_request",
     "status": "completed", "content_template": "Know anyone who needs roof work? Refer them and earn $50!",
     "scheduled_for": "2026-06-20T09:00:00Z"},
    {"id": "fu-4", "lead_id": "lead-5", "type": "satisfaction_survey",
     "status": "pending", "content_template": "How was your experience with us? Take our 2-minute survey.",
     "scheduled_for": "2026-07-10T10:00:00Z"},
]


@router.get("")
async def list_followups():
    """List all follow-ups."""
    return mock_followups


@router.post("/{followup_id}/trigger")
async def trigger_followup(followup_id: str):
    """Trigger a pending follow-up immediately."""
    for fu in mock_followups:
        if fu["id"] == followup_id:
            if fu["status"] != "pending":
                raise HTTPException(status_code=400, detail="Follow-up already sent or completed")
            fu["status"] = "sent"
            from datetime import datetime
            fu["sent_at"] = datetime.utcnow().isoformat() + "Z"
            return fu
    raise HTTPException(status_code=404, detail="Follow-up not found")