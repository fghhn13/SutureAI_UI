"""Instructor reviews, student acceptance and appeals, and the per-viewer report view."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models import (
    Appeal,
    AppealReason,
    AppealStatus,
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

MAX_APPEALS_PER_REPORT = 5
# Points suggested to the instructor when an appeal against an event is accepted.
SUGGESTED_ADJUSTMENT = {"error": 4, "warning": 2}
ADJUSTMENT_LIMIT = 20


class ReviewError(ValueError):
    pass


def _iso(dt) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def event_seconds(event: dict[str, Any]) -> float | None:
    """Seconds into the video for a timeline event (``timeSeconds`` or an "m:ss" label)."""
    if isinstance(event.get("timeSeconds"), (int, float)):
        return float(event["timeSeconds"])
    try:
        parts = [int(p) for p in str(event.get("time", "")).split(":")]
    except ValueError:
        return None
    if len(parts) == 2:
        return float(parts[0] * 60 + parts[1])
    if len(parts) == 3:
        return float(parts[0] * 3600 + parts[1] * 60 + parts[2])
    return None


def _clamp_score(v: int) -> int:
    return max(0, min(100, v))


def is_reviewed(ts: TrainingSession) -> bool:
    return ts.review is not None and ts.review.status == ReviewStatus.COMPLETED.value


def review_label(ts: TrainingSession) -> str:
    return "Reviewed" if is_reviewed(ts) else "Pending"


def open_appeals(ts: TrainingSession) -> list[Appeal]:
    return [a for a in ts.appeals if a.status == AppealStatus.OPEN.value]


def appeal_adjustment(ts: TrainingSession) -> int:
    return sum(a.score_adjustment or 0 for a in ts.appeals if a.status == AppealStatus.ACCEPTED.value)


def current_score(ts: TrainingSession) -> int:
    """Score the student currently holds: the completed review's, else AI + accepted appeals."""
    if is_reviewed(ts):
        return ts.review.final_score
    return _clamp_score(ts.report.overall_score + appeal_adjustment(ts))


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
    return {"kind": fb.kind, "message": fb.message, "createdAt": _iso(fb.created_at)}


def appeal_out(a: Appeal) -> dict[str, Any]:
    return {
        "id": a.id,
        "eventId": a.event_id,
        "eventTime": a.event_time_s,
        "eventLabel": a.event_label,
        "eventType": a.event_type,
        "reason": a.reason,
        "message": a.message,
        "status": a.status,
        "suggestedAdjustment": a.suggested_adjustment,
        "scoreAdjustment": a.score_adjustment,
        "decisionNote": a.decision_note,
        "decidedBy": a.decided_by.display_name if a.decided_by else None,
        "decidedAt": _iso(a.decided_at),
        "createdAt": _iso(a.created_at),
    }


def _overlay(base: Any, over: Any) -> Any:
    """Merge a translation overlay: dicts recursively, same-length lists item by item."""
    if isinstance(base, dict) and isinstance(over, dict):
        return {**base, **{k: _overlay(base.get(k), v) for k, v in over.items()}}
    if isinstance(base, list) and isinstance(over, list) and len(base) == len(over):
        return [_overlay(b, o) for b, o in zip(base, over)]
    return over


def preferred_lang(accept_language: str | None) -> str:
    """'zh' when the client asks for Chinese first, else 'en'."""
    first = (accept_language or "").split(",")[0].strip().lower()
    return "zh" if first.startswith("zh") else "en"


def report_view(ts: TrainingSession, viewer: User, lang: str = "en") -> dict[str, Any]:
    """Report document as ``viewer`` should see it, in ``lang`` where a translation exists."""
    stored = ts.report.content
    translation = (stored.get("i18n") or {}).get(lang)
    if translation:
        stored = _overlay(stored, translation)
    content = {k: v for k, v in stored.items() if k not in _LEGACY_KEYS and k != "i18n"}
    is_owner = viewer.id == ts.user_id
    reviewed = is_reviewed(ts)
    # Students only see a review once it is completed; drafts stay with the instructor.
    review = ts.review if (viewer.is_staff or reviewed) else None

    # Mark timeline events that were appealed; accepted appeals overturn the event.
    by_event = {a.event_id: a for a in ts.appeals if a.event_id}
    timeline = []
    for e in content.get("timeline", []):
        a = by_event.get(e.get("id"))
        if a is not None:
            e = {
                **e,
                "appeal": {"id": a.id, "status": a.status},
                "overturned": a.status == AppealStatus.ACCEPTED.value,
            }
        timeline.append(e)
    content["timeline"] = timeline

    content["student"] = ts.user.display_name
    content["status"] = "Reviewed" if reviewed else "Pending Instructor Review"
    highlights = dict(content.get("assessmentHighlights") or {})
    highlights["reviewStatus"] = (
        f"Reviewed by {ts.review.instructor.display_name}" if reviewed else "Pending instructor review"
    )
    content["assessmentHighlights"] = highlights
    content["review"] = review_out(review)
    content["feedback"] = feedback_out(ts.feedback)
    content["appeals"] = [appeal_out(a) for a in ts.appeals]
    content["personalNote"] = (ts.note.note if ts.note else "") if is_owner else None
    content["scores"] = {
        "ai": ts.report.overall_score,
        "appealAdjustment": appeal_adjustment(ts),
        "current": current_score(ts),
        "confirmedByInstructor": reviewed,
    }
    content["meta"] = {
        "sessionId": ts.id,
        "studentId": ts.user_id,
        "studentName": ts.user.display_name,
        "aiScore": ts.report.overall_score,
        "isOwner": is_owner,
        "canReview": viewer.is_staff,
        "canRespond": is_owner,
        "maxAppeals": MAX_APPEALS_PER_REPORT,
        "lang": lang if translation else "en",
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


def accept_report(db: Session, ts: TrainingSession, student: User, *, message: str = "") -> StudentFeedback:
    _require_report(ts)
    if open_appeals(ts):
        raise ReviewError("Withdraw or wait for your open appeals before accepting the report.")
    fb = ts.feedback
    if fb is None:
        fb = StudentFeedback(session_id=ts.id, student_id=student.id)
        db.add(fb)
        ts.feedback = fb
    fb.kind = "accept"
    fb.status = "resolved"
    fb.message = message.strip()
    fb.created_at = utcnow()
    db.commit()
    return fb


def create_appeal(
    db: Session,
    ts: TrainingSession,
    student: User,
    *,
    event_id: str | None,
    reason: str,
    message: str,
) -> Appeal:
    _require_report(ts)
    if reason not in {r.value for r in AppealReason}:
        raise ReviewError("Unknown appeal reason.")
    message = message.strip()
    if not message:
        raise ReviewError("Explain why you are appealing.")
    if len(ts.appeals) >= MAX_APPEALS_PER_REPORT:
        raise ReviewError(f"A report can have at most {MAX_APPEALS_PER_REPORT} appeals.")

    event = None
    if event_id:
        event = next((e for e in ts.report.content.get("timeline", []) if e.get("id") == event_id), None)
        if event is None:
            raise ReviewError("That event is not in this report.")
        if any(a.event_id == event_id for a in ts.appeals):
            raise ReviewError("You have already appealed this event.")
    elif any(a.event_id is None for a in ts.appeals):
        raise ReviewError("You have already appealed the report as a whole.")

    appeal = Appeal(
        session_id=ts.id,
        student_id=student.id,
        event_id=event_id,
        event_time_s=event_seconds(event) if event else None,
        event_label=event.get("title") if event else None,
        event_type=event.get("type") if event else None,
        reason=reason,
        message=message,
        suggested_adjustment=SUGGESTED_ADJUSTMENT.get(event.get("type"), 0) if event else 0,
    )
    db.add(appeal)
    ts.appeals.append(appeal)
    # A new disagreement supersedes an earlier "accept".
    if ts.feedback is not None:
        db.delete(ts.feedback)
        ts.feedback = None
    db.commit()
    return appeal


def withdraw_appeal(db: Session, ts: TrainingSession, appeal_id: int) -> None:
    appeal = _get_appeal(ts, appeal_id)
    if appeal.status != AppealStatus.OPEN.value:
        raise ReviewError("Only open appeals can be withdrawn.")
    ts.appeals.remove(appeal)
    db.delete(appeal)
    db.commit()


def decide_appeal(
    db: Session,
    ts: TrainingSession,
    instructor: User,
    appeal_id: int,
    *,
    accept: bool,
    note: str,
    score_adjustment: int | None,
) -> Appeal:
    """Accepting overturns the event and adjusts the score (also on a completed review)."""
    appeal = _get_appeal(ts, appeal_id)
    if appeal.status != AppealStatus.OPEN.value:
        raise ReviewError("This appeal has already been decided.")
    note = note.strip()
    if not note:
        raise ReviewError("Explain your decision to the student.")
    if accept:
        adj = appeal.suggested_adjustment if score_adjustment is None else score_adjustment
        if abs(adj) > ADJUSTMENT_LIMIT:
            raise ReviewError(f"Score adjustment must be between -{ADJUSTMENT_LIMIT} and {ADJUSTMENT_LIMIT}.")
        appeal.status = AppealStatus.ACCEPTED.value
        appeal.score_adjustment = adj
        if is_reviewed(ts):
            ts.review.final_score = _clamp_score(ts.review.final_score + adj)
    else:
        appeal.status = AppealStatus.REJECTED.value
        appeal.score_adjustment = 0
    appeal.decision_note = note
    appeal.decided_by_id = instructor.id
    appeal.decided_by = instructor
    appeal.decided_at = utcnow()
    db.commit()
    return appeal


def _get_appeal(ts: TrainingSession, appeal_id: int) -> Appeal:
    appeal = next((a for a in ts.appeals if a.id == appeal_id), None)
    if appeal is None:
        raise ReviewError("Appeal not found.")
    return appeal


def save_note(db: Session, ts: TrainingSession, note: str) -> StudentNote:
    if ts.note is None:
        ts.note = StudentNote(session_id=ts.id)
        db.add(ts.note)
    ts.note.note = note[:5000]
    db.commit()
    return ts.note
