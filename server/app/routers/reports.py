from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..deps import get_current_user, get_db, get_owned_session, require_staff
from ..models import SessionStatus, TrainingSession, User
from ..schemas import AcceptIn, AppealDecisionIn, AppealIn, NoteIn, ReportListItem, ReviewIn
from ..services import reviews
from ..services.access import can_view_student

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("", response_model=list[ReportListItem])
def list_reports(
    student_id: int | None = Query(None, alias="studentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReportListItem]:
    """The current user's reports, or (instructors) a given student's."""
    target = student_id if student_id is not None else user.id
    if not can_view_student(db, user, target):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    sessions = db.scalars(
        select(TrainingSession)
        .where(
            TrainingSession.user_id == target,
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


def _lang(request: Request) -> str:
    return reviews.preferred_lang(request.headers.get("accept-language"))


def _ready(ts: TrainingSession) -> TrainingSession:
    if ts.report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report is not ready yet.")
    return ts


@router.get("/{session_id}")
def get_report(
    request: Request,
    ts: TrainingSession = Depends(get_owned_session),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    return reviews.report_view(_ready(ts), user, _lang(request))


@router.put("/{session_id}/review")
def put_review(
    request: Request,
    body: ReviewIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    instructor: User = Depends(require_staff),
) -> dict[str, Any]:
    """Save a draft review, or complete it (``complete: true``) so the student sees it."""
    try:
        reviews.save_review(
            db,
            _ready(ts),
            instructor,
            final_score=body.final_score,
            comment=body.comment,
            teaching_focus=body.teaching_focus,
            complete=body.complete,
        )
    except reviews.ReviewError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None
    return reviews.report_view(ts, instructor, _lang(request))


def _decide(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except reviews.ReviewError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None


def _require_owner(ts: TrainingSession, user: User) -> None:
    if ts.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the student can do this on their report.")


@router.post("/{session_id}/accept")
def accept_report(
    request: Request,
    body: AcceptIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Student accepts the report as it stands."""
    _require_owner(ts, user)
    _decide(reviews.accept_report, db, _ready(ts), user, message=body.message)
    return reviews.report_view(ts, user, _lang(request))


@router.post("/{session_id}/appeals", status_code=status.HTTP_201_CREATED)
def create_appeal(
    request: Request,
    body: AppealIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Student disputes a timeline event (``eventId``) or the whole report."""
    _require_owner(ts, user)
    _decide(
        reviews.create_appeal, db, _ready(ts), user,
        event_id=body.event_id, reason=body.reason, message=body.message,
    )
    return reviews.report_view(ts, user, _lang(request))


@router.delete("/{session_id}/appeals/{appeal_id}")
def withdraw_appeal(
    request: Request,
    appeal_id: int,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _require_owner(ts, user)
    _decide(reviews.withdraw_appeal, db, _ready(ts), appeal_id)
    return reviews.report_view(ts, user, _lang(request))


@router.post("/{session_id}/appeals/{appeal_id}/decision")
def decide_appeal(
    request: Request,
    appeal_id: int,
    body: AppealDecisionIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    instructor: User = Depends(require_staff),
) -> dict[str, Any]:
    """Instructor accepts (event overturned, score adjusted) or rejects an appeal."""
    _decide(
        reviews.decide_appeal, db, _ready(ts), instructor, appeal_id,
        accept=body.decision == "accept", note=body.note, score_adjustment=body.score_adjustment,
    )
    return reviews.report_view(ts, instructor, _lang(request))


@router.put("/{session_id}/note")
def put_note(
    request: Request,
    body: NoteIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _require_owner(ts, user)
    reviews.save_note(db, _ready(ts), body.note)
    return reviews.report_view(ts, user, _lang(request))
