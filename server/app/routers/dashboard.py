from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import User
from ..services.dashboard import build_dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    return build_dashboard(db, user)
