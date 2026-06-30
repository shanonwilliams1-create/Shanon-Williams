"""
Referrals Router — Mock API for referral program
"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/referrals", tags=["referrals"])

mock_referrals = [
    {"id": "ref-1", "referred_name": "Bob the Builder", "referred_email": "bob@example.com",
     "status": "signed_up", "reward_status": "pending"},
    {"id": "ref-2", "referred_name": "Alice Electric", "referred_email": "alice@example.com",
     "status": "invited", "reward_status": "pending"},
    {"id": "ref-3", "referred_name": "Carl's Carpentry", "referred_email": "carl@example.com",
     "status": "active", "reward_status": "earned"},
]


@router.get("")
async def list_referrals():
    """List all referrals."""
    return mock_referrals


@router.post("")
async def create_referral(data: Dict[str, Any]):
    """Create a new referral invite."""
    import uuid
    new_ref = {"id": str(uuid.uuid4())[:8], **data, "status": "invited", "reward_status": "pending"}
    mock_referrals.append(new_ref)
    return new_ref