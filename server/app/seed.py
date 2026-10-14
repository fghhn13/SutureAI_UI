"""Demo data: tasks, two cohorts, instructors, and students with distinct training histories.

Student history is produced by the real pipeline (mock scoring + template reports) with
back-dated timestamps; each student follows a skill curve (improving, declining, …) so the
instructor views have something to show. The three hand-written sample reports from
``server/seed/reports`` are attached to Alex and Jordan.

    python -m app.seed            # seed an empty database
    python -m app.seed --reset    # drop everything and reseed
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from .config import Settings, get_settings
from .db import Base, Database
from .models import (
    Cohort,
    FeedbackKind,
    FeedbackStatus,
    InstructorReview,
    Report,
    ReviewStatus,
    Role,
    SessionStatus,
    StudentFeedback,
    Task,
    TrainingSession,
    User,
    utcnow,
)
from .providers.mock_scoring import MockScoringProvider
from .providers.template_report import TemplateReportProvider
from .security import hash_password
from .services.pipeline import Pipeline

SEED_DIR = Path(__file__).resolve().parents[1] / "seed"
DEMO_PASSWORD = "suture-local-demo"

FIVE_DIMS = ["Efficiency", "Accuracy", "Procedural Flow", "Safety", "Product Quality"]

TASKS = [
    Task(
        id="simple-suturing",
        name="Simple Suturing Practice",
        description="Place three simple interrupted sutures on the practice pad.",
        estimated_duration="15–20 min",
        dimensions=FIVE_DIMS,
        sort_order=1,
    ),
    Task(
        id="knot-tying",
        name="Knot Tying Basics",
        description="Tie three square knots with instruments, laying each throw flat.",
        estimated_duration="12–18 min",
        dimensions=["Accuracy", "Procedural Flow", "Safety", "Product Quality"],
        sort_order=2,
    ),
    Task(
        id="needle-handling",
        name="Needle Handling",
        description="Load, reposition and pass the needle through the target zones.",
        estimated_duration="10–15 min",
        dimensions=["Efficiency", "Accuracy", "Safety"],
        sort_order=3,
    ),
]

COHORTS = [
    ("group-a", "Group A", "Fundamentals of Simulated Suturing"),
    ("group-b", "Group B", "Introductory Simulated Suturing Lab"),
]

# (email, name, cohorts taught)
INSTRUCTORS = [
    ("chen@demo.local", "Dr. Chen", ["group-a", "group-b"]),
    ("patel@demo.local", "Dr. Patel", ["group-b"]),
]


@dataclass
class StudentSpec:
    email: str
    name: str
    cohort: str
    focus: str
    task: str
    sessions: int = 0
    # Days ago of the oldest / newest generated session.
    span: tuple[int, int] = (18, 300)
    # Skill (≈ expected score) at the oldest and newest session.
    skill: tuple[float, float] = (65, 75)
    # (sample file, task id, days ago)
    samples: list[tuple[str, str, int]] = field(default_factory=list)
    failed_sessions: int = 0
    clarify_latest: str | None = None


STUDENTS = [
    StudentSpec(
        "alex@demo.local", "Alex Rivera", "group-a",
        "Insertion control and consistent stitch spacing", "simple-suturing",
        sessions=14, span=(18, 300), skill=(64, 80),
        samples=[
            ("report-default.json", "simple-suturing", 9),
            ("report-alt.json", "knot-tying", 5),
            ("report-video-demo.json", "needle-handling", 2),
        ],
    ),
    StudentSpec(
        "sam@demo.local", "Sam Taylor", "group-a",
        "Pacing between steps", "simple-suturing",
        sessions=10, span=(2, 120), skill=(56, 86),
    ),
    StudentSpec(
        "priya@demo.local", "Priya Shah", "group-a",
        "Needle angle under time pressure", "simple-suturing",
        sessions=9, span=(3, 110), skill=(82, 54),
        clarify_latest="The needle drop flagged near the end was me re-gripping on purpose, "
        "not a drop — could you check the clip?",
    ),
    StudentSpec(
        "lee@demo.local", "Lee Wong", "group-a",
        "Knot security", "knot-tying",
        sessions=4, span=(40, 95), skill=(66, 70),
    ),
    StudentSpec(
        "jordan@demo.local", "Jordan Kim", "group-b",
        "Knot security and steady needle orientation", "knot-tying",
        sessions=3, span=(18, 200), skill=(62, 70),
        samples=[
            ("report-default.json", "simple-suturing", 12),
            ("report-alt.json", "knot-tying", 4),
        ],
    ),
    StudentSpec(
        "mia@demo.local", "Mia Garcia", "group-b",
        "Instrument handling basics", "needle-handling",
        sessions=6, span=(1, 60), skill=(52, 57), failed_sessions=1,
    ),
    StudentSpec(
        "noah@demo.local", "Noah Brown", "group-b",
        "Getting started", "simple-suturing",
    ),
]

REVIEW_COMMENTS = [
    "Agree with the AI assessment. {focus} is the thing to work on next.",
    "Good session overall. Keep drilling {focus} before your next recording.",
    "Adjusted slightly — the video shows better control than the score suggests. Watch {focus}.",
    "Solid work. Spend your next practice block on {focus}.",
]


def is_empty(database: Database) -> bool:
    with database.session() as db:
        return db.scalar(select(User.id).limit(1)) is None


def has_cohorts(database: Database) -> bool:
    with database.session() as db:
        return db.scalar(select(Cohort.id).limit(1)) is not None


def seed(database: Database, settings: Settings) -> None:
    now = utcnow().replace(second=0, microsecond=0)
    skills: dict[str, float] = {}
    pipeline = Pipeline(
        database,
        settings,
        MockScoringProvider(skill_fn=skills.get),
        TemplateReportProvider(),
    )
    password_hash = hash_password(DEMO_PASSWORD)  # scrypt is slow; hash once

    with database.session() as db:
        for task in TASKS:
            db.merge(task)
        cohorts = {cid: Cohort(id=cid, name=name, course_name=course) for cid, name, course in COHORTS}
        db.add_all(cohorts.values())
        instructors = {}
        for email, name, teaches in INSTRUCTORS:
            inst = User(
                email=email,
                password_hash=password_hash,
                display_name=name,
                role=Role.INSTRUCTOR.value,
            )
            db.add(inst)
            for cid in teaches:
                cohorts[cid].instructors.append(inst)
            instructors[email] = inst
        db.commit()
        # Who reviews each cohort's reports in the demo.
        reviewer_ids = {"group-a": instructors["chen@demo.local"].id, "group-b": instructors["patel@demo.local"].id}

    for spec in STUDENTS:
        rng = random.Random(spec.email)
        with database.session() as db:
            cohort = db.get(Cohort, spec.cohort)
            user = User(
                email=spec.email,
                password_hash=password_hash,
                display_name=spec.name,
                role=Role.STUDENT.value,
                course_name=cohort.course_name,
                training_focus=spec.focus,
                current_task_id=spec.task,
                current_task_due=(now + timedelta(days=21)).strftime("%b %d, %Y"),
            )
            db.add(user)
            cohort.students.append(user)
            db.commit()
            user_id = user.id

        session_ids: list[str] = []

        # Generated history, oldest first so "change vs last" deltas line up.
        if spec.sessions:
            lo, hi = spec.span
            days_ago = sorted(rng.sample(range(lo, hi + 1), spec.sessions), reverse=True)
            task_ids = [t.id for t in TASKS]
            for i, d in enumerate(days_ago):
                progress = i / max(1, spec.sessions - 1)
                when = now - timedelta(days=d, hours=rng.randint(0, 8), minutes=rng.randint(0, 59))
                with database.session() as db:
                    ts = TrainingSession(
                        user_id=user_id,
                        task_id=spec.task if rng.random() < 0.6 else rng.choice(task_ids),
                        status=SessionStatus.UPLOADED.value,
                        created_at=when,
                        uploaded_at=when,
                    )
                    db.add(ts)
                    db.commit()
                    session_ids.append(ts.id)
                start, end = spec.skill
                skills[ts.id] = start + (end - start) * progress + rng.uniform(-3, 3)
                pipeline.run_until_idle()
                _backdate(database, ts.id, when)

        for filename, sample_task_id, d in spec.samples:
            session_ids.append(_add_sample(database, user_id, spec.name, filename, sample_task_id, now - timedelta(days=d, hours=2)))

        for i in range(spec.failed_sessions):
            when = now - timedelta(days=i, hours=3)
            with database.session() as db:
                db.add(
                    TrainingSession(
                        user_id=user_id,
                        task_id=spec.task,
                        status=SessionStatus.FAILED.value,
                        error="ScoringError: video too dark to detect instruments (demo)",
                        created_at=when,
                        uploaded_at=when,
                    )
                )
                db.commit()

        _seed_reviews(database, rng, user_id, reviewer_ids[spec.cohort], now, spec)


def _add_sample(database: Database, user_id: int, name: str, filename: str, task_id: str, when: datetime) -> str:
    content = json.loads((SEED_DIR / "reports" / filename).read_text(encoding="utf-8"))
    content["student"] = name
    content["recordedAt"] = when.isoformat() + "Z"
    content["dateTime"] = when.strftime("%b %d, %Y · %H:%M UTC")
    with database.session() as db:
        ts = TrainingSession(
            user_id=user_id,
            task_id=task_id,
            status=SessionStatus.READY.value,
            created_at=when,
            uploaded_at=when,
            finished_at=when + timedelta(minutes=3),
        )
        db.add(ts)
        db.flush()
        db.add(
            Report(
                session_id=ts.id,
                generator="seed",
                overall_score=int(content["overallScore"]),
                content=content,
                created_at=when,
            )
        )
        db.commit()
        return ts.id


def _seed_reviews(
    database: Database,
    rng: random.Random,
    user_id: int,
    reviewer_id: int,
    now: datetime,
    spec: StudentSpec,
) -> None:
    """Older reports are mostly reviewed (some accepted by the student); recent ones wait.

    Sample reports get the review state described in their JSON so the demo matches them.
    """
    with database.session() as db:
        sessions = db.scalars(
            select(TrainingSession)
            .where(TrainingSession.user_id == user_id, TrainingSession.status == SessionStatus.READY.value)
            .order_by(TrainingSession.created_at)
        ).all()
        for ts in sessions:
            when = ts.uploaded_at or ts.created_at
            content = ts.report.content
            focus = (content.get("assessmentHighlights") or {}).get("practiceFocus", "technique").lower()
            ai = ts.report.overall_score

            sample_review = content.get("instructorReview") if ts.report.generator == "seed" else None
            if sample_review is not None:
                status = sample_review.get("reviewStatus")
                if status in {"Complete", "In Progress"}:
                    done = status == "Complete"
                    db.add(
                        InstructorReview(
                            session_id=ts.id,
                            instructor_id=reviewer_id,
                            status=ReviewStatus.COMPLETED.value if done else ReviewStatus.DRAFT.value,
                            ai_score=ai,
                            final_score=int(sample_review.get("finalConfirmedScore") or ai),
                            comment=sample_review.get("teacherComment", ""),
                            teaching_focus=sample_review.get("teachingFocus", []),
                            created_at=when + timedelta(days=1),
                            completed_at=when + timedelta(days=1) if done else None,
                        )
                    )
                objection = content.get("studentObjection") or {}
                if objection.get("submitted"):
                    db.add(
                        StudentFeedback(
                            session_id=ts.id,
                            student_id=user_id,
                            kind=FeedbackKind.CLARIFY.value,
                            message=objection.get("concernText", ""),
                            referenced_clip=objection.get("referencedClip"),
                            status=FeedbackStatus.OPEN.value,
                            created_at=when + timedelta(hours=6),
                        )
                    )
                continue

            age_days = (now - when).days
            if age_days >= 10 and rng.random() < 0.85:
                final = max(0, min(100, ai + rng.choice([0, 0, 0, -2, 2, 3, -3])))
                reviewed_at = when + timedelta(days=rng.randint(1, 4))
                db.add(
                    InstructorReview(
                        session_id=ts.id,
                        instructor_id=reviewer_id,
                        status=ReviewStatus.COMPLETED.value,
                        ai_score=ai,
                        final_score=final,
                        comment=rng.choice(REVIEW_COMMENTS).format(focus=focus),
                        teaching_focus=[focus],
                        created_at=reviewed_at,
                        completed_at=reviewed_at,
                    )
                )
                if rng.random() < 0.5:
                    db.add(
                        StudentFeedback(
                            session_id=ts.id,
                            student_id=user_id,
                            kind=FeedbackKind.ACCEPT.value,
                            status=FeedbackStatus.RESOLVED.value,
                            created_at=reviewed_at + timedelta(hours=5),
                        )
                    )

        if spec.clarify_latest and sessions:
            latest = sessions[-1]
            clip = next(
                (c for c in latest.report.content.get("clips", []) if c.get("type") == "Error"),
                None,
            )
            db.add(
                StudentFeedback(
                    session_id=latest.id,
                    student_id=user_id,
                    kind=FeedbackKind.CLARIFY.value,
                    message=spec.clarify_latest,
                    referenced_clip=f"{clip['time']} - {clip['label']}" if clip else None,
                    status=FeedbackStatus.OPEN.value,
                    created_at=(latest.uploaded_at or latest.created_at) + timedelta(hours=4),
                )
            )
        db.commit()


def _backdate(database: Database, session_id: str, when: datetime) -> None:
    with database.session() as db:
        ts = db.get(TrainingSession, session_id)
        ts.finished_at = when + timedelta(minutes=2)
        if ts.scoring:
            ts.scoring.created_at = when + timedelta(minutes=1)
        if ts.report:
            ts.report.created_at = ts.finished_at
            ts.report.content["recordedAt"] = when.isoformat() + "Z"
            ts.report.content["dateTime"] = when.strftime("%b %d, %Y · %H:%M UTC")
            # JSON column: reassign so SQLAlchemy sees the change.
            ts.report.content = dict(ts.report.content)
        db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="drop all tables before seeding")
    args = parser.parse_args()

    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    database = Database(settings.resolved_database_url)
    if args.reset:
        from . import models  # noqa: F401

        Base.metadata.drop_all(database.engine)
        if settings.video_dir.is_dir():
            for f in settings.video_dir.iterdir():
                if f.is_file():
                    f.unlink()
    database.create_all()
    if not is_empty(database):
        print("Database already has users; use --reset to reseed.")
        return
    seed(database, settings)
    print(f"Seeded {settings.resolved_database_url} (password for demo accounts: {DEMO_PASSWORD})")


if __name__ == "__main__":
    main()
