import asyncio
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/leads", tags=["leads"])

# In-memory stub for demonstration (since real DB models are being built by Build Engineer)
mock_leads = []

@router.get("/stream")
async def stream_leads(request: Request):
    """
    SSE endpoint for real-time lead alerts.
    Sends a keepalive event every 30 seconds.
    """
    async def event_generator():
        while True:
            # Check if client closed connection
            if await request.is_disconnected():
                break

            # Send keepalive event
            # SSE format is "event: <event_name>\ndata: <data_payload>\n\n"
            yield "event: keepalive\ndata: ping\n\n"
            
            await asyncio.sleep(30)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("")
async def get_leads():
    """Get a list of leads."""
    return {"leads": mock_leads, "total": len(mock_leads)}

@router.get("/{lead_id}")
async def get_lead(lead_id: str):
    """Get a single lead by ID."""
    # Stub: Return a sample lead
    return {"id": lead_id, "title": "Sample Lead", "status": "new"}

@router.post("")
async def create_lead(lead_data: Dict[str, Any]):
    """Create a new lead."""
    # Stub: Return the created lead with a mock ID
    new_lead = {**lead_data, "id": "mock-uuid-" + str(len(mock_leads) + 1)}
    mock_leads.append(new_lead)
    return new_lead

@router.patch("/{lead_id}")
async def update_lead(lead_id: str, update_data: Dict[str, Any]):
    """Update a lead's status or other fields."""
    # Stub: Return the updated lead
    return {"id": lead_id, **update_data}
