"""
Appointments Router — Mock API for appointment scheduling
"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/appointments", tags=["appointments"])

mock_appointments = [
    {"id": "apt-1", "lead_id": "lead-1", "status": "confirmed",
     "start_time": "2026-06-28T10:00:00Z", "end_time": "2026-06-28T12:00:00Z",
     "notes": "Initial consultation for kitchen remodel"},
    {"id": "apt-2", "lead_id": "lead-2", "status": "scheduled",
     "start_time": "2026-06-29T14:00:00Z", "end_time": "2026-06-29T15:30:00Z",
     "notes": "Bathroom estimate"},
    {"id": "apt-3", "lead_id": "lead-4", "status": "completed",
     "start_time": "2026-06-22T09:00:00Z", "end_time": "2026-06-22T11:00:00Z",
     "notes": "Roof inspection completed"},
    {"id": "apt-4", "lead_id": "lead-3", "status": "scheduled",
     "start_time": "2026-07-01T08:00:00Z", "end_time": "2026-07-01T10:00:00Z",
     "notes": "Deck measurement"},
]


@router.get("")
async def list_appointments():
    """List all appointments."""
    return mock_appointments


@router.post("")
async def create_appointment(data: Dict[str, Any]):
    """Create a new appointment."""
    import uuid
    new_apt = {"id": str(uuid.uuid4())[:8], **data, "status": "scheduled"}
    mock_appointments.append(new_apt)
    return new_apt


@router.delete("/{appointment_id}")
async def cancel_appointment(appointment_id: str):
    """Cancel an appointment."""
    for apt in mock_appointments:
        if apt["id"] == appointment_id:
            apt["status"] = "cancelled"
            return {"message": "Appointment cancelled", "appointment": apt}
    raise HTTPException(status_code=404, detail="Appointment not found")