"""
Outreach Router — Mock API for sent/scheduled messages
"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/outreach", tags=["outreach"])

mock_outreach = [
    {"id": "out-1", "channel": "email", "status": "delivered", "content": "Hi John, I saw your kitchen renovation post...",
     "lead_id": "lead-1", "sent_at": "2026-06-23T14:30:00Z"},
    {"id": "out-2", "channel": "sms", "status": "sent", "content": "Hi Sarah, I can do bathroom remodels...",
     "lead_id": "lead-2", "sent_at": "2026-06-24T09:15:00Z"},
    {"id": "out-3", "channel": "email", "status": "pending", "content": "Hi Mike, I'd love to discuss your deck...",
     "lead_id": "lead-3", "scheduled_at": "2026-06-25T08:00:00Z"},
    {"id": "out-4", "channel": "email", "status": "opened", "content": "Hi Lisa, regarding your roof repair...",
     "lead_id": "lead-4", "sent_at": "2026-06-22T16:45:00Z"},
]


@router.get("")
async def list_outreach():
    """List all outreach messages."""
    return mock_outreach


@router.post("")
async def create_outreach(data: Dict[str, Any]):
    """Create a new outreach message."""
    import uuid
    new_msg = {"id": str(uuid.uuid4())[:8], **data, "status": "pending"}
    mock_outreach.append(new_msg)
    return new_msg


@router.post("/{outreach_id}/send")
async def send_outreach(outreach_id: str):
    """Send a pending outreach message."""
    for msg in mock_outreach:
        if msg["id"] == outreach_id:
            msg["status"] = "sent"
            from datetime import datetime
            msg["sent_at"] = datetime.utcnow().isoformat() + "Z"
            return msg
    raise HTTPException(status_code=404, detail="Outreach not found")