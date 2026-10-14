"""Instructor reviews, student feedback/clarifications, and the per-viewer report view."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models import (
    FeedbackKind,
    FeedbackStatus,
    InstructorReview,
    ReviewStatus,
    SessionStatus,
    StudentFeedback,
    StudentNote,
    TrainingSession,
    User,
    utcnow,
)

# Review/feedback placeholders the report generators used to embed in the document;
# live data from the DB replaces them in report_view().
_LEGACY_KEYS = (
    "instructorEvaluation",
    "instructorReview",
    "studentObjection",
    "studentResponse",
    "personalNote",
    "instructorNote",
    "reviewStatus",
)


class ReviewError(ValueError):
    pass


def _iso(dt) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def is_reviewed(ts: TrainingSession) -> bool:
    return ts.review is not None and ts.review.status == ReviewStatus.COMPLETED.value


def review_label(ts: TrainingSession) -> str:
    return "Reviewed" if is_reviewed(ts) else "Pending"


def has_open_clarification(ts: TrainingSession) -> bool:
    fb = ts.feedback
    return fb is not None and fb.kind == FeedbackKind.CLARIFY.value and fb.status == FeedbackStatus.OPEN.value


def review_out(review: InstructorReview | None) -> dict[str, Any] | None:
    if review is None:
        return None
    return {
        "status": review.status,
        "instructorName": review.instructor.display_name,
        "aiScore": review.ai_score,
        "finalScore": review.final_score,
        "alignment": review.alignment,
        "comment": review.comment,
        "teachingFocus": review.teaching_focus,
        "updatedAt": _iso(review.updated_at),
        "completedAt": _iso(review.completed_at),
    }


def feedback_out(fb: StudentFeedback | None) -> dict[str, Any] | None:
    if fb is None:
        return None
    return {
        "kind": fb.kind,
        "message": fb.message,
        "referencedClip": fb.referenced_clip,
        "status": fb.status,
        "createdAt": _iso(fb.created_at),
        "response": fb.response,
        "respondedBy": fb.responded_by.display_name if fb.responded_by else None,
        "respondedAt": _iso(fb.responded_at),
    }


def report_view(ts: TrainingSession, viewer: User) -> dict[str, Any]:
    """Report document as ``viewer`` should see it."""
    content = {k: v for k, v in ts.report.content.items() if k not in _LEGACY_KEYS}
    is_owner = viewer.id == ts.user_id
    reviewed = is_reviewed(ts)
    # Students only see a review once it is completed; drafts stay with the instructor.
    review = ts.review if (viewer.is_staff or reviewed) else None

    content["student"] = ts.user.display_name
    content["status"] = "Reviewed" if reviewed else "Pending Instructor Review"
    highlights = dict(content.get("assessmentHighlights") or {})
    highlights["reviewStatus"] = (
        f"Reviewed by {ts.review.instructor.display_name}" if reviewed else "Pending instructor review"
    )
    content["assessmentHighlights"] = highlights
    content["review"] = review_out(review)
    content["feedback"] = feedback_out(ts.feedback)
    content["personalNote"] = (ts.note.note if ts.note else "") if is_owner else None
    content["meta"] = {
        "sessionId": ts.id,
        "studentId": ts.user_id,
        "studentName": ts.user.display_name,
        "aiScore": ts.report.overall_score,
        "isOwner": is_owner,
        "canReview": viewer.is_staff,
        "canRespond": is_owner,
    }
    return content


def _require_report(ts: TrainingSession) -> None:
    if ts.status != SessionStatus.READY.value or ts.report is None:
        raise ReviewError("The report for this session is not ready yet.")


def save_review(
    db: Session,
    ts: TrainingSession,
    instructor: User,
    *,
    final_score: int,
    comment: str,
    teaching_focus: list[str],
    complete: bool,
) -> InstructorReview:
    _require_report(ts)
    review = ts.review
    if review is None:
        review = InstructorReview(session_id=ts.id, ai_score=ts.report.overall_score)
        db.add(review)
        ts.review = review
    review.instructor_id = instructor.id
    review.instructor = instructor
    review.final_score = final_score
    review.comment = comment.strip()
    review.teaching_focus = [f.strip() for f in teaching_focus if f.strip()][:10]
    if complete:
        review.status = ReviewStatus.COMPLETED.value
        review.completed_at = utcnow()
    elif review.status != ReviewStatus.COMPLETED.value:
        review.status = ReviewStatus.DRAFT.value
    db.commit()
    return review


def submit_feedback(
    db: Session,
    ts: TrainingSession,
    student: User,
    *,
    kind: str,
    message: str,
    referenced_clip: str | None,
) -> StudentFeedback:
    _require_report(ts)
    if kind not in {k.value for k in FeedbackKind}:
        raise ReviewError("Unknown feedback kind.")
    message = message.strip()
    if kind == FeedbackKind.CLARIFY.value and not message:
        raise ReviewError("Describe what you would like clarified.")
    fb = ts.feedback
    if fb is not None and fb.response:
        raise ReviewError("Your instructor has already responded to your feedback.")
    if fb is None:
        fb = StudentFeedback(session_id=ts.id, student_id=student.id)
        db.add(fb)
        ts.feedback = fb
    fb.kind = kind
    fb.message = message
    fb.referenced_clip = (referenced_clip or "").strip()[:200] or None
    fb.status = (
        FeedbackStatus.OPEN.value if kind == FeedbackKind.CLARIFY.value else FeedbackStatus.RESOLVED.value
    )
    fb.created_at = utcnow()
    db.commit()
    return fb


def respond_feedback(db: Session, ts: TrainingSession, instructor: User, *, response: str) -> StudentFeedback:
    fb = ts.feedback
    if fb is None or fb.kind != FeedbackKind.CLARIFY.value:
        raise ReviewError("There is no clarification request on this report.")
    response = response.strip()
    if not response:
        raise ReviewError("Write a response first.")
    fb.response = response
    fb.responded_by_id = instructor.id
    fb.responded_by = instructor
    fb.responded_at = utcnow()
    fb.status = FeedbackStatus.RESOLVED.value
    db.commit()
    return fb


def save_note(db: Session, ts: TrainingSession, note: str) -> StudentNote:
    if ts.note is None:
        ts.note = StudentNote(session_id=ts.id)
        db.add(ts.note)
    ts.note.note = note[:5000]
    db.commit()
    return ts.note
