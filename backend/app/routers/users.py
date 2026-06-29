from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current user profile.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "trade": current_user.trade,
        "target_trades": current_user.target_trades or [],
        "service_zip_codes": current_user.service_zip_codes or [],
        "location": current_user.location or "",
        "subscription_tier": current_user.subscription_tier,
        "trial_leads_used": current_user.trial_leads_used,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }


@router.put("/zip-codes")
async def update_zip_codes(
    zip_codes: list[str],
    current_user: User = Depends(get_current_user),
):
    """Update user's service zip codes with tier-based limits."""
    tier_limits = {"starter": 1, "pro": 5, "elite": 999}
    limit = tier_limits.get(current_user.subscription_tier, 1)
    if len(zip_codes) > limit:
        raise HTTPException(
            status_code=400,
            detail=f"Your plan allows up to {limit} zip code{'s' if limit > 1 else ''}. Upgrade to add more."
        )
    current_user.service_zip_codes = zip_codes
    # In production, save to DB
    return {"service_zip_codes": zip_codes, "limit": limit}


@router.put("/trades")
async def update_trades(
    trades: list[str],
    current_user: User = Depends(get_current_user),
):
    """Update user's target trades for lead filtering."""
    valid_trades = ["electrician", "plumber", "carpenter", "roofer", "landscaper",
                    "painter", "general", "hvac", "other"]
    for t in trades:
        if t not in valid_trades:
            raise HTTPException(status_code=400, detail=f"Invalid trade: {t}")
    current_user.target_trades = trades
    return {"target_trades": trades}


@router.post("/upgrade")
async def upgrade_plan(
    tier: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Placeholder upgrade endpoint. In production, this creates a Stripe checkout session.
    For now, it upgrades the user to the requested tier directly.
    """
    valid_tiers = ["starter", "pro", "elite"]
    if tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Choose from: {', '.join(valid_tiers)}")

    current_user.subscription_tier = tier
    # Reset trial counter since they're now a paid user
    current_user.trial_leads_used = 0
    await db.flush()

    return {
        "message": f"Upgraded to {tier} plan",
        "subscription_tier": tier,
        "trial_leads_used": 0,
    }