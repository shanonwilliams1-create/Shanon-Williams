import asyncio
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request, Query, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.database import get_db

router = APIRouter(prefix="/leads", tags=["leads"])

# In-memory stub for demonstration
mock_leads = [
    {"id": "lead-1", "title": "Kitchen Renovation", "source": "facebook", "contact_name": "John Smith",
     "zip_code": "98101", "city": "Seattle", "state": "WA", "budget_max": 15000, "status": "new",
     "trade_category": "general", "lead_score": 0.85},
    {"id": "lead-2", "title": "Bathroom Remodel", "source": "craigslist", "contact_name": "Sarah Jones",
     "zip_code": "98102", "city": "Seattle", "state": "WA", "budget_max": 8000, "status": "new",
     "trade_category": "plumber", "lead_score": 0.72},
    {"id": "lead-3", "title": "Deck Building", "source": "permit", "contact_name": "Mike Wilson",
     "zip_code": "97201", "city": "Portland", "state": "OR", "budget_max": 12000, "status": "contacted",
     "trade_category": "carpenter", "lead_score": 0.91},
    {"id": "lead-4", "title": "Roof Repair", "source": "job_board", "contact_name": "Lisa Park",
     "zip_code": "98103", "city": "Seattle", "state": "WA", "budget_max": 5000, "status": "new",
     "trade_category": "roofer", "lead_score": 0.65},
    {"id": "lead-5", "title": "Fence Installation", "source": "nextdoor", "contact_name": "Tom Brown",
     "zip_code": "94102", "city": "San Francisco", "state": "CA", "budget_max": 3000, "status": "new",
     "trade_category": "landscaper", "lead_score": 0.58},
]


async def check_trial_access(current_user: User, db: AsyncSession):
    """
    Trial gate: users on 'starter' tier who have used their free lead get blocked.
    """
    PAID_TIERS = {"pro", "elite"}
    if current_user.subscription_tier in PAID_TIERS:
        return  # Paid users have full access

    # 'starter' tier users are on trial — check the limit
    if current_user.trial_leads_used >= 1:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "trial_exhausted",
                "message": "You've used your free lead! Pick a plan to continue.",
                "trial_leads_used": current_user.trial_leads_used,
                "trial_limit": 1
            }
        )


@router.get("/stream")
async def stream_leads(request: Request):
    """SSE endpoint for real-time lead alerts."""
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            yield "event: keepalive\ndata: ping\n\n"
            await asyncio.sleep(30)
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("")
async def get_leads(
    zip_codes: Optional[str] = Query(None, description="Comma-separated zip codes to filter by"),
    trades: Optional[str] = Query(None, description="Comma-separated trade categories to filter by"),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a list of leads, filtered by zip codes and/or trades."""
    # Check trial access — trial users see leads until they exhaust their free one
    # For the list view we don't consume the trial, only viewing details does
    await check_trial_access(current_user, db)

    leads = mock_leads.copy()

    # Filter by zip codes
    if zip_codes:
        zip_list = [z.strip() for z in zip_codes.split(",")]
        leads = [l for l in leads if l.get("zip_code", "") in zip_list]
    elif current_user and current_user.service_zip_codes:
        user_zips = current_user.service_zip_codes
        leads = [l for l in leads if l.get("zip_code", "") in user_zips]

    # Filter by trades
    if trades:
        trade_list = [t.strip().lower() for t in trades.split(",")]
        leads = [l for l in leads if l.get("trade_category", "").lower() in trade_list]
    elif current_user and current_user.target_trades:
        user_trades = [t.lower() for t in current_user.target_trades]
        leads = [l for l in leads if l.get("trade_category", "").lower() in user_trades]

    # Filter by status
    if status:
        leads = [l for l in leads if l.get("status") == status]

    # Search
    if search:
        q = search.lower()
        leads = [l for l in leads if q in l.get("title", "").lower() or q in l.get("contact_name", "").lower()]

    # Pagination
    total = len(leads)
    start = (page - 1) * per_page
    end = start + per_page
    page_leads = leads[start:end]

    return {"leads": page_leads, "total": total, "page": page, "per_page": per_page}


@router.get("/trial-status")
async def get_trial_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's current trial lead usage."""
    return {
        "trial_leads_used": current_user.trial_leads_used,
        "trial_limit": 1,
        "is_trial_active": current_user.subscription_tier == "starter" and current_user.trial_leads_used < 1,
        "is_blocked": current_user.subscription_tier == "starter" and current_user.trial_leads_used >= 1,
        "subscription_tier": current_user.subscription_tier,
    }


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single lead by ID. Consumes the free trial lead if applicable."""
    # Check trial access
    await check_trial_access(current_user, db)

    for l in mock_leads:
        if l["id"] == lead_id:
            # If user is on trial (starter tier), increment their trial counter
            if current_user.subscription_tier == "starter" and current_user.trial_leads_used < 1:
                current_user.trial_leads_used = 1
                await db.flush()
            return {
                **l,
                "_trial": {
                    "trial_leads_used": current_user.trial_leads_used,
                    "trial_limit": 1,
                    "remaining": max(0, 1 - current_user.trial_leads_used),
                }
            }
    raise HTTPException(status_code=404, detail="Lead not found")


@router.post("")
async def create_lead(lead_data: Dict[str, Any]):
    """Create a new lead."""
    import uuid
    new_lead = {"id": str(uuid.uuid4()), **lead_data, "lead_score": 0.5}
    mock_leads.append(new_lead)
    return new_lead


@router.patch("/{lead_id}")
async def update_lead(lead_id: str, update_data: Dict[str, Any]):
    """Update a lead's status or other fields."""
    for l in mock_leads:
        if l["id"] == lead_id:
            l.update(update_data)
            return l
    raise HTTPException(status_code=404, detail="Lead not found")