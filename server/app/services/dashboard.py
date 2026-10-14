"""Student dashboard payload, aggregated from sessions and reports."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import InstructorReview, SessionStatus, TrainingSession, User, utcnow
from .reviews import review_label

S = SessionStatus
_IN_PROGRESS = {S.CREATED.value, S.UPLOADED.value, S.SCORING.value, S.SCORED.value, S.GENERATING.value}
TREND_WINDOW = 5


def short_reliability(label: str | None) -> str:
    return (label or "—").replace(" Confidence", "")


def load_sessions(db: Session, user_ids: list[int]) -> list[TrainingSession]:
    """Sessions (oldest first) with everything the dashboards read, in a few queries."""
    if not user_ids:
        return []
    return list(
        db.scalars(
            select(TrainingSession)
            .where(TrainingSession.user_id.in_(user_ids))
            .options(
                selectinload(TrainingSession.task),
                selectinload(TrainingSession.report),
                selectinload(TrainingSession.scoring),
                selectinload(TrainingSession.review).selectinload(InstructorReview.instructor),
                selectinload(TrainingSession.feedback),
            )
            .order_by(TrainingSession.created_at)
        )
    )


def issue_count(content: dict[str, Any]) -> int:
    return sum(1 for e in content.get("timeline", []) if e.get("type") in {"warning", "error"})


def build_dashboard(db: Session, user: User) -> dict[str, Any]:
    sessions = load_sessions(db, [user.id])

    ready = [s for s in sessions if s.status == S.READY.value and s.report is not None]
    in_progress = [s for s in sessions if s.status in _IN_PROGRESS]
    failed = [s for s in sessions if s.status == S.FAILED.value]
    latest = ready[-1] if ready else None

    return {
        "studentName": user.display_name,
        "courseName": (user.cohort.course_name if user.cohort else user.course_name) or "—",
        "trainingFocus": user.training_focus or "—",
        "currentTask": _current_task(user, sessions),
        "lastReport": _last_report(latest),
        "trends": _trends(ready),
        "nextSteps": (latest.report.content.get("suggestions") or [])[:3] if latest else [],
        "notifications": _notifications(ready, in_progress, failed),
        # Unfinished work the student can act on (watch, finish uploading, or retry).
        "inProgress": [
            {
                "sessionId": s.id,
                "taskName": s.task.name,
                "status": s.status,
                "createdAt": s.created_at.isoformat() + "Z",
            }
            for s in sorted(in_progress + failed, key=lambda s: s.created_at, reverse=True)[:5]
        ],
        "history": [
            {
                "sessionId": s.id,
                "date": (s.uploaded_at or s.created_at).strftime("%b %d, %Y"),
                "task": s.task.name,
                "score": s.report.overall_score,
                "reliability": short_reliability(s.report.content.get("reliability")),
                "instructorStatus": review_label(s),
            }
            for s in reversed(ready)
        ],
        "trainingActivityCalendar": build_calendar(sessions),
    }


def _current_task(user: User, sessions: list[TrainingSession]) -> dict[str, Any] | None:
    task = user.current_task
    if task is None:
        return None
    attempts = sum(1 for s in sessions if s.task_id == task.id and s.status != S.CREATED.value)
    return {
        "id": task.id,
        "name": task.name,
        "status": f"In progress · {attempts} recording(s)" if attempts else "Not started",
        "dueDate": user.current_task_due or "—",
        "estimatedDuration": task.estimated_duration or "—",
        "dimensions": task.dimensions,
    }


def _last_report(latest: TrainingSession | None) -> dict[str, Any] | None:
    if latest is None:
        return None
    c = latest.report.content
    highlights = c.get("assessmentHighlights") or {}
    return {
        "sessionId": latest.id,
        "taskName": latest.task.name,
        "score": latest.report.overall_score,
        "reliability": c.get("reliability") or "—",
        "mainStrength": (c.get("strengths") or [highlights.get("strongestDimension", "—")])[0],
        "mainIssue": highlights.get("mainIssue") or "—",
        "instructorStatus": review_label(latest),
    }


def _trends(ready: list[TrainingSession]) -> dict[str, Any]:
    window = ready[-TREND_WINDOW:]
    if not window:
        return {
            "sessionsCount": 0,
            "scoreChange": "—",
            "completionTime": "—",
            "errorCount": "—",
            "weakestDimension": "—",
        }
    first, last = window[0], window[-1]
    diff = last.report.overall_score - first.report.overall_score
    score_change = f"{diff:+d} pts over last {len(window)}" if len(window) > 1 else "—"

    durations = [s.scoring.raw.get("durationSeconds") for s in window if s.scoring is not None]
    durations = [d for d in durations if d]
    completion = (
        f"{round(durations[0])}s → {round(durations[-1])}s" if len(durations) > 1 else "—"
    )

    dim_scores: dict[str, list[int]] = defaultdict(list)
    for s in window:
        for d in s.report.content.get("dimensions", []):
            dim_scores[d["name"]].append(d["score"])
    weakest = min(dim_scores, key=lambda k: sum(dim_scores[k]) / len(dim_scores[k])) if dim_scores else "—"

    return {
        "sessionsCount": len(ready),
        "scoreChange": score_change,
        "completionTime": completion,
        "errorCount": f"{issue_count(first.report.content)} → {issue_count(last.report.content)}",
        "weakestDimension": weakest,
    }


def _notifications(
    ready: list[TrainingSession],
    in_progress: list[TrainingSession],
    failed: list[TrainingSession],
) -> list[str]:
    notes: list[str] = []
    processing = [s for s in in_progress if s.status != S.CREATED.value]
    if processing:
        notes.append(f"{len(processing)} recording(s) are being analysed.")
    if failed:
        notes.append(f"{len(failed)} recording(s) failed to process — open them to retry.")
    week_ago = utcnow() - timedelta(days=7)
    recent = [s for s in ready if s.finished_at and s.finished_at >= week_ago]
    if recent:
        notes.append(f"{len(recent)} new report(s) ready in the last 7 days.")
    reviewed = [
        s for s in ready if s.review and s.review.completed_at and s.review.completed_at >= week_ago
    ]
    if reviewed:
        notes.append(f"Your instructor reviewed {len(reviewed)} report(s) this week.")
    replied = [
        s for s in ready if s.feedback and s.feedback.responded_at and s.feedback.responded_at >= week_ago
    ]
    if replied:
        notes.append(f"Your instructor answered {len(replied)} clarification request(s).")
    pending_review = [s for s in ready if review_label(s) == "Pending"]
    if pending_review:
        notes.append(f"{len(pending_review)} report(s) are waiting for instructor review.")
    return notes or ["You're all caught up."]


def build_calendar(sessions: list[TrainingSession]) -> dict[str, Any]:
    by_date: dict[str, dict[str, Any]] = {}
    for s in sessions:
        if s.status == S.CREATED.value:
            continue
        when = s.uploaded_at or s.created_at
        key = when.strftime("%Y-%m-%d")
        day = by_date.setdefault(
            key, {"sessions": 0, "tasks": [], "totalMinutes": 0, "reportsReady": 0, "records": []}
        )
        day["sessions"] += 1
        if s.task.name not in day["tasks"]:
            day["tasks"].append(s.task.name)
        if s.scoring is not None:
            day["totalMinutes"] += max(1, round((s.scoring.raw.get("durationSeconds") or 0) / 60))
        if s.status == S.READY.value and s.report is not None:
            day["reportsReady"] += 1
            day["records"].append(
                {
                    "taskName": s.task.name,
                    "score": s.report.overall_score,
                    "reliability": short_reliability(s.report.content.get("reliability")),
                    "instructorStatus": review_label(s),
                    "sessionId": s.id,
                }
            )
    this_year = utcnow().year
    years = sorted({int(k[:4]) for k in by_date} | {this_year}, reverse=True)
    return {"years": years, "defaultYear": this_year, "activityByDate": by_date}
