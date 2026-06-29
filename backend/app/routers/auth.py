from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, Token, PasswordResetRequest, DirectResetPassword
from app.services.auth_service import (
    hash_password, verify_password, create_access_token, create_refresh_token, decode_token
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/signup", response_model=Token)
async def signup(request: SignupRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user and return tokens.
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    new_user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        trade=request.trade,
        service_area_radius=request.service_area_radius,
        subscription_tier="starter"  # Default tier
    )
    
    db.add(new_user)
    await db.flush()  # To get the ID
    
    access_token = create_access_token(new_user.id, new_user.email, new_user.subscription_tier)
    refresh_token = create_refresh_token(new_user.id, new_user.email, new_user.subscription_tier)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/login", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user and return tokens.
    """
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(user.id, user.email, user.subscription_tier)
    refresh_token = create_refresh_token(user.id, user.email, user.subscription_tier)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """
    Refresh access token using a valid refresh token.
    """
    try:
        payload = decode_token(refresh_token)
        if not payload.get("refresh"):
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
            
        access_token = create_access_token(user.id, user.email, user.subscription_tier)
        new_refresh_token = create_refresh_token(user.id, user.email, user.subscription_tier)
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/forgot-password")
async def forgot_password(request: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    """
    Stub for forgot password functionality.
    In a real app, this would send an email with a reset link.
    """
    # Just return success even if user doesn't exist for security
    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: DirectResetPassword, db: AsyncSession = Depends(get_db)):
    """
    Direct password reset (no email needed).
    Finds user by email and updates password directly.
    """
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email address"
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    user.password_hash = hash_password(request.new_password)
    await db.flush()
    
    return {"message": "Password reset successfully. You can now sign in with your new password."}
