"""Who may see which student's data."""

from __future__ import annotations

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from ..models import Cohort, Role, User, cohort_instructors, cohort_members


def can_view_student(db: Session, viewer: User, student_id: int) -> bool:
    if viewer.id == student_id or viewer.role == Role.ADMIN.value:
        return True
    if viewer.role != Role.INSTRUCTOR.value:
        return False
    return bool(
        db.scalar(
            select(
                exists().where(
                    cohort_instructors.c.user_id == viewer.id,
                    cohort_members.c.cohort_id == cohort_instructors.c.cohort_id,
                    cohort_members.c.user_id == student_id,
                )
            )
        )
    )


def visible_cohorts(db: Session, viewer: User) -> list[Cohort]:
    if viewer.role == Role.ADMIN.value:
        return list(db.scalars(select(Cohort).order_by(Cohort.name)))
    if viewer.role == Role.INSTRUCTOR.value:
        return list(viewer.teaching)
    return []
