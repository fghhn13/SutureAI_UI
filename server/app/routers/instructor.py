from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..deps import get_db, require_staff
from ..models import Cohort, User
from ..services import instructor as svc
from ..services.access import can_view_student, visible_cohorts

router = APIRouter(prefix="/api/instructor", tags=["instructor"])


def _cohort(db: Session, viewer: User, cohort_id: str) -> Cohort:
    cohort = next((c for c in visible_cohorts(db, viewer) if c.id == cohort_id), None)
    if cohort is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cohort not found.")
    return cohort


@router.get("/cohorts")
def list_cohorts(db: Session = Depends(get_db), viewer: User = Depends(require_staff)) -> list[dict[str, Any]]:
    return [svc.cohort_out(c) for c in visible_cohorts(db, viewer)]


@router.get("/cohorts/{cohort_id}")
def cohort_overview(
    cohort_id: str,
    db: Session = Depends(get_db),
    viewer: User = Depends(require_staff),
) -> dict[str, Any]:
    return svc.cohort_overview(db, _cohort(db, viewer, cohort_id))


@router.get("/students/{student_id}")
def student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    viewer: User = Depends(require_staff),
) -> dict[str, Any]:
    student = db.get(User, student_id)
    if student is None or student.is_staff or not can_view_student(db, viewer, student_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    return svc.student_detail(db, student)


@router.get("/reviews")
def review_queue(
    filter: str = "pending",
    cohort_id: str | None = Query(None, alias="cohortId"),
    db: Session = Depends(get_db),
    viewer: User = Depends(require_staff),
) -> dict[str, Any]:
    if filter not in svc.QUEUE_FILTERS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"filter must be one of {svc.QUEUE_FILTERS}")
    cohorts = [_cohort(db, viewer, cohort_id)] if cohort_id else visible_cohorts(db, viewer)
    return svc.review_queue(db, cohorts, filter)
