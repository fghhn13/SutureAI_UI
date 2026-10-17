"""Cohort-level views for instructors: roster stats, attention list, heatmap, review queue."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean
from typing import Any

from sqlalchemy.orm import Session

from ..models import Cohort, SessionStatus, TrainingSession, User, utcnow
from ..providers.dimensions import DIMENSIONS
from .dashboard import build_calendar, load_sessions
from .reviews import current_score, is_reviewed, open_appeals

S = SessionStatus
_IN_PROGRESS = {S.UPLOADED.value, S.SCORING.value, S.SCORED.value, S.GENERATING.value}

DIMENSION_NAMES = [d.name for d in DIMENSIONS]
TREND_POINTS = 8          # scores shown in the roster sparkline
RECENT_WINDOW = 5         # reports used for dimension averages / "recent average"
CHANGE_WINDOW = 3         # reports per side when computing recentChange
DECLINE_THRESHOLD = -8    # recentChange at or below this flags a decline
LOW_SCORE = 60
INACTIVE_DAYS = 14

_SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def _when(ts: TrainingSession) -> datetime:
    return ts.uploaded_at or ts.created_at


def _ready(sessions: list[TrainingSession]) -> list[TrainingSession]:
    return [s for s in sessions if s.status == S.READY.value and s.report is not None]


def _dimension_averages(ready: list[TrainingSession]) -> dict[str, float | None]:
    scores: dict[str, list[int]] = defaultdict(list)
    for s in ready[-RECENT_WINDOW:]:
        for d in s.report.content.get("dimensions", []):
            scores[d["name"]].append(d["score"])
    return {name: round(mean(scores[name]), 1) if scores[name] else None for name in DIMENSION_NAMES}


def student_stats(student: User, sessions: list[TrainingSession], now: datetime) -> dict[str, Any]:
    """One roster row. ``sessions`` must be this student's sessions, oldest first."""
    active = [s for s in sessions if s.status != S.CREATED.value]
    ready = _ready(sessions)
    scores = [s.report.overall_score for s in ready]
    last_active = max((_when(s) for s in active), default=None)

    # Mean of the last few reports vs the few before them; smoother than latest-vs-previous.
    recent_change = None
    if len(scores) >= 2:
        k = min(CHANGE_WINDOW, len(scores) // 2)
        recent_change = round(mean(scores[-k:]) - mean(scores[-2 * k : -k]))

    dims = _dimension_averages(ready)
    known = {k: v for k, v in dims.items() if v is not None}
    return {
        "id": student.id,
        "name": student.display_name,
        "email": student.email,
        "lastActiveAt": _iso(last_active),
        "daysSinceActive": (now - last_active).days if last_active else None,
        "sessions7d": sum(1 for s in active if _when(s) >= now - timedelta(days=7)),
        "sessions30d": sum(1 for s in active if _when(s) >= now - timedelta(days=30)),
        "totalReports": len(ready),
        "latestScore": scores[-1] if scores else None,
        "recentChange": recent_change,
        "trend": scores[-TREND_POINTS:],
        "dimensionAverages": dims,
        "weakestDimension": min(known, key=known.get) if known else None,
        "pendingReviews": sum(1 for s in ready if not is_reviewed(s)),
        "openAppeals": sum(len(open_appeals(s)) for s in ready),
        "failedSessions": sum(1 for s in sessions if s.status == S.FAILED.value),
        "inProgress": sum(1 for s in sessions if s.status in _IN_PROGRESS),
    }


def attention_items(
    student: User, sessions: list[TrainingSession], stats: dict[str, Any]
) -> list[dict[str, Any]]:
    """Reasons an instructor should look at this student now."""
    items: list[dict[str, Any]] = []

    def add(kind: str, severity: str, message: str, session_id: str | None = None):
        items.append(
            {
                "studentId": student.id,
                "studentName": student.display_name,
                "kind": kind,
                "severity": severity,
                "message": message,
                "sessionId": session_id,
            }
        )

    for s in _ready(sessions):
        n = len(open_appeals(s))
        if n:
            add("appeal", "high", f"Appealed {n} finding(s) in {s.task.name}", s.id)

    change = stats["recentChange"]
    if change is not None and stats["totalReports"] >= 3 and change <= DECLINE_THRESHOLD:
        add("declining", "high", f"Scores down {abs(change)} pts over their last few sessions")

    latest = stats["latestScore"]
    if latest is not None and latest < LOW_SCORE:
        add("low_score", "medium", f"Latest score {latest} is below {LOW_SCORE}")

    days = stats["daysSinceActive"]
    if days is None:
        add("inactive", "medium", "Has not recorded any training yet")
    elif days >= INACTIVE_DAYS:
        add("inactive", "medium", f"No training for {days} days")

    if stats["failedSessions"]:
        add("failed", "low", f"{stats['failedSessions']} recording(s) failed to process")
    return items


def _avg(values: list[int]) -> float | None:
    return round(mean(values), 1) if values else None


def cohort_overview(db: Session, cohort: Cohort) -> dict[str, Any]:
    now = utcnow()
    students = list(cohort.students)
    sessions = load_sessions(db, [u.id for u in students])
    by_student: dict[int, list[TrainingSession]] = defaultdict(list)
    for s in sessions:
        by_student[s.user_id].append(s)

    roster, attention = [], []
    for u in students:
        stats = student_stats(u, by_student[u.id], now)
        roster.append(stats)
        attention.extend(attention_items(u, by_student[u.id], stats))
    attention.sort(key=lambda a: (_SEVERITY_ORDER[a["severity"]], a["studentName"]))

    active = [s for s in sessions if s.status != S.CREATED.value]
    ready = _ready(sessions)

    def in_window(s: TrainingSession, start_days: int, end_days: int) -> bool:
        return now - timedelta(days=start_days) <= _when(s) < now - timedelta(days=end_days)

    return {
        "cohort": cohort_out(cohort),
        "kpis": {
            "students": len(students),
            "activeStudents7d": sum(1 for r in roster if r["sessions7d"]),
            "sessions7d": sum(1 for s in active if in_window(s, 7, 0)),
            "sessionsPrev7d": sum(1 for s in active if in_window(s, 14, 7)),
            "avgScore30d": _avg([s.report.overall_score for s in ready if in_window(s, 30, 0)]),
            "avgScorePrev30d": _avg([s.report.overall_score for s in ready if in_window(s, 60, 30)]),
            "pendingReviews": sum(r["pendingReviews"] for r in roster),
            "openAppeals": sum(r["openAppeals"] for r in roster),
        },
        "attention": attention,
        "dimensions": DIMENSION_NAMES,
        "cohortDimensionAverages": {
            name: _avg([r["dimensionAverages"][name] for r in roster if r["dimensionAverages"][name] is not None])
            for name in DIMENSION_NAMES
        },
        "students": roster,
    }


def cohort_out(cohort: Cohort) -> dict[str, Any]:
    return {
        "id": cohort.id,
        "name": cohort.name,
        "courseName": cohort.course_name,
        "studentCount": len(cohort.students),
    }


def _final_score(s: TrainingSession) -> int | None:
    """Score after review/appeals, or None when it still equals the AI score unconfirmed."""
    if s.report is None:
        return None
    cs = current_score(s)
    return cs if is_reviewed(s) or cs != s.report.overall_score else None


def _review_state(s: TrainingSession) -> str:
    if s.review is None:
        return "none"
    return s.review.status


def _feedback_state(s: TrainingSession) -> str | None:
    """Student's stance on the report: open appeal > decided appeals > accepted > none."""
    if open_appeals(s):
        return "appeal_open"
    if s.appeals:
        return "appeal_decided"
    if s.feedback is not None:
        return "accepted"
    return None


def student_detail(db: Session, student: User) -> dict[str, Any]:
    now = utcnow()
    sessions = load_sessions(db, [student.id])
    ready = _ready(sessions)
    stats = student_stats(student, sessions, now)
    return {
        "student": {
            "id": student.id,
            "name": student.display_name,
            "email": student.email,
            "cohort": cohort_out(student.cohort) if student.cohort else None,
            "currentTask": student.current_task.name if student.current_task else None,
            "trainingFocus": student.training_focus,
        },
        "stats": stats,
        "attention": attention_items(student, sessions, stats),
        "dimensions": DIMENSION_NAMES,
        "scoreSeries": [
            {
                "sessionId": s.id,
                "recordedAt": _iso(_when(s)),
                "taskName": s.task.name,
                "score": s.report.overall_score,
                "finalScore": _final_score(s),
                "dimensions": {d["name"]: d["score"] for d in s.report.content.get("dimensions", [])},
            }
            for s in ready
        ],
        "sessions": [
            {
                "sessionId": s.id,
                "recordedAt": _iso(_when(s)),
                "taskName": s.task.name,
                "status": s.status,
                "score": s.report.overall_score if s.report else None,
                "finalScore": _final_score(s),
                "reviewState": _review_state(s),
                "feedbackState": _feedback_state(s),
                "error": s.error,
            }
            for s in reversed(sessions)
            if s.status != S.CREATED.value
        ],
        "trainingActivityCalendar": build_calendar(sessions),
    }


QUEUE_FILTERS = ("pending", "appeals", "completed")


def review_queue(db: Session, cohorts: list[Cohort], queue_filter: str) -> dict[str, Any]:
    student_cohort = {u.id: c for c in cohorts for u in c.students}
    students = {u.id: u for c in cohorts for u in c.students}
    ready = _ready(load_sessions(db, list(students)))

    buckets: dict[str, list[TrainingSession]] = {
        "pending": [s for s in ready if not is_reviewed(s)],
        "appeals": [s for s in ready if open_appeals(s)],
        "completed": [s for s in ready if is_reviewed(s)],
    }
    chosen = buckets[queue_filter]
    if queue_filter == "completed":
        chosen.sort(key=lambda s: s.review.completed_at or s.review.updated_at, reverse=True)
    else:
        chosen.sort(key=_when)  # oldest waiting first

    items = []
    for s in chosen:
        content = s.report.content
        items.append(
            {
                "sessionId": s.id,
                "studentId": s.user_id,
                "studentName": students[s.user_id].display_name,
                "cohortName": student_cohort[s.user_id].name,
                "taskName": s.task.name,
                "recordedAt": _iso(_when(s)),
                "aiScore": s.report.overall_score,
                "finalScore": s.review.final_score if s.review else None,
                "reviewState": _review_state(s),
                "feedbackState": _feedback_state(s),
                "reliability": content.get("reliability"),
                "issueCount": sum(
                    1 for e in content.get("timeline", []) if e.get("type") in {"warning", "error"}
                ),
                "reviewedAt": _iso(s.review.completed_at) if s.review else None,
            }
        )
    return {"items": items, "counts": {k: len(v) for k, v in buckets.items()}}

