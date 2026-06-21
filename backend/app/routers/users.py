from fastapi import APIRouter, Depends
from app.middleware.auth_middleware import get_current_user
from app.models.user import User

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
        "subscription_tier": current_user.subscription_tier,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at
    }
