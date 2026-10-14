from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..config import Settings
from ..deps import get_current_user, get_db, get_settings
from ..models import AuthSession, User, utcnow
from ..schemas import LoginIn, UserOut
from ..security import new_session_token, session_token_id, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(
    body: LoginIn,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")

    now = utcnow()
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
    token = new_session_token()
    ttl = timedelta(hours=settings.session_ttl_hours)
    db.add(AuthSession(id=session_token_id(token), user_id=user.id, expires_at=now + ttl))
    db.commit()

    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=int(ttl.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        db.execute(delete(AuthSession).where(AuthSession.id == session_token_id(token)))
        db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
