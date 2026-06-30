"""
Reviews Router — Mock API for Google review requests
"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/reviews", tags=["reviews"])

mock_reviews = [
    {"id": "rev-1", "lead_id": "lead-3", "status": "published",
     "rating": 5, "review_url": "https://g.page/r/example1/review"},
    {"id": "rev-2", "lead_id": "lead-4", "status": "pending",
     "rating": None, "review_url": None},
    {"id": "rev-3", "lead_id": "lead-1", "status": "declined",
     "rating": None, "review_url": None},
]


@router.get("")
async def list_reviews():
    """List all review requests."""
    return mock_reviews


@router.post("/request")
async def request_review(data: Dict[str, Any]):
    """Request a review for a lead."""
    import uuid
    lead_id = data.get("lead_id")
    if not lead_id:
        raise HTTPException(status_code=400, detail="lead_id is required")
    new_rev = {"id": str(uuid.uuid4())[:8], "lead_id": lead_id, "status": "pending", "rating": None, "review_url": None}
    mock_reviews.append(new_rev)
    return new_rev