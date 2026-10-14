from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..deps import get_current_user, get_db, get_owned_session, require_staff
from ..models import SessionStatus, TrainingSession, User
from ..schemas import FeedbackIn, FeedbackResponseIn, NoteIn, ReportListItem, ReviewIn
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


def _ready(ts: TrainingSession) -> TrainingSession:
    if ts.report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report is not ready yet.")
    return ts


@router.get("/{session_id}")
def get_report(
    ts: TrainingSession = Depends(get_owned_session),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    return reviews.report_view(_ready(ts), user)


@router.put("/{session_id}/review")
def put_review(
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
    return reviews.report_view(ts, instructor)


@router.post("/{session_id}/feedback")
def post_feedback(
    body: FeedbackIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Student accepts the report or asks for clarification."""
    if ts.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the student can respond to their report.")
    try:
        reviews.submit_feedback(
            db,
            _ready(ts),
            user,
            kind=body.kind,
            message=body.message,
            referenced_clip=body.referenced_clip,
        )
    except reviews.ReviewError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None
    return reviews.report_view(ts, user)


@router.post("/{session_id}/feedback/response")
def post_feedback_response(
    body: FeedbackResponseIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    instructor: User = Depends(require_staff),
) -> dict[str, Any]:
    try:
        reviews.respond_feedback(db, _ready(ts), instructor, response=body.response)
    except reviews.ReviewError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None
    return reviews.report_view(ts, instructor)


@router.put("/{session_id}/note")
def put_note(
    body: NoteIn,
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if ts.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Notes are private to the student.")
    reviews.save_note(db, _ready(ts), body.note)
    return reviews.report_view(ts, user)
