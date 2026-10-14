from __future__ import annotations

from collections.abc import Iterator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .config import Settings
from .db import Database
from .models import AuthSession, TrainingSession, User, utcnow
from .security import session_token_id
from .services.access import can_view_student


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_database(request: Request) -> Database:
    return request.app.state.db


def get_db(database: Database = Depends(get_database)) -> Iterator[Session]:
    with database.session() as db:
        yield db


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in.")
    auth = db.get(AuthSession, session_token_id(token))
    if auth is None or auth.expires_at <= utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired.")
    return auth.user


def require_staff(user: User = Depends(get_current_user)) -> User:
    if not user.is_staff:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Instructor access required.")
    return user


def get_owned_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TrainingSession:
    """Load a training session the current user may see: their own, or (for instructors)
    one belonging to a student in a cohort they teach."""
    ts = db.get(TrainingSession, session_id)
    # 404 rather than 403 so ids of other users' sessions are not confirmed.
    if ts is None or not can_view_student(db, user, ts.user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Training session not found.")
    return ts
