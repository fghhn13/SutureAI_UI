from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..deps import get_current_user, get_db, get_owned_session
from ..models import SessionStatus, TrainingSession, User
from ..schemas import ReportListItem

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("", response_model=list[ReportListItem])
def list_reports(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReportListItem]:
    sessions = db.scalars(
        select(TrainingSession)
        .where(
            TrainingSession.user_id == user.id,
            TrainingSession.status == SessionStatus.READY.value,
        )
        .options(selectinload(TrainingSession.task), selectinload(TrainingSession.report))
        .order_by(TrainingSession.created_at.desc())
    )
    items = []
    for ts in sessions:
        if ts.report is None:
            continue
        recorded = ts.uploaded_at or ts.created_at
        items.append(
            ReportListItem(
                session_id=ts.id,
                label=f"{ts.task.name} · {recorded:%b %d, %Y} · {ts.report.overall_score}",
                task_name=ts.task.name,
                overall_score=ts.report.overall_score,
                recorded_at=recorded,
            )
        )
    return items


@router.get("/{session_id}")
def get_report(ts: TrainingSession = Depends(get_owned_session)) -> dict[str, Any]:
    if ts.report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report is not ready yet.")
    return ts.report.content
