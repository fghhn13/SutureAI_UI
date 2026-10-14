"""Demo data: tasks, two student accounts, and a training history per student.

History is produced by the real pipeline (mock scoring + template reports) with
back-dated timestamps, plus the three hand-written sample reports from
``server/seed/reports``.

    python -m app.seed            # seed an empty database
    python -m app.seed --reset    # drop everything and reseed
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from .config import Settings, get_settings
from .db import Base, Database
from .models import Report, SessionStatus, Task, TrainingSession, User, utcnow
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

# (email, name, course, focus, current task, generated sessions, sample reports)
USERS = [
    (
        "alex@demo.local",
        "Alex Rivera",
        "Fundamentals of Simulated Suturing",
        "Insertion control and consistent stitch spacing",
        "simple-suturing",
        14,
        [
            ("report-default.json", "simple-suturing", 9),
            ("report-alt.json", "knot-tying", 5),
            ("report-video-demo.json", "needle-handling", 2),
        ],
    ),
    (
        "jordan@demo.local",
        "Jordan Kim",
        "Introductory Simulated Suturing Lab",
        "Knot security and steady needle orientation",
        "knot-tying",
        3,
        [
            ("report-default.json", "simple-suturing", 12),
            ("report-alt.json", "knot-tying", 4),
        ],
    ),
]


def is_empty(database: Database) -> bool:
    with database.session() as db:
        return db.scalar(select(User.id).limit(1)) is None


def seed(database: Database, settings: Settings) -> None:
    now = utcnow().replace(second=0, microsecond=0)
    pipeline = Pipeline(database, settings, MockScoringProvider(), TemplateReportProvider())

    with database.session() as db:
        for task in TASKS:
            db.merge(task)
        db.commit()

    for email, name, course, focus, task_id, n_generated, samples in USERS:
        with database.session() as db:
            user = User(
                email=email,
                password_hash=hash_password(DEMO_PASSWORD),
                display_name=name,
                role="student",
                course_name=course,
                training_focus=focus,
                current_task_id=task_id,
                current_task_due=(now + timedelta(days=21)).strftime("%b %d, %Y"),
            )
            db.add(user)
            db.commit()
            user_id = user.id

        # Generated history: spread over the last ~10 months, oldest first so that
        # "change vs last" deltas line up.
        rng = random.Random(email)
        days_ago = sorted(rng.sample(range(18, 300), n_generated), reverse=True)
        task_ids = [t.id for t in TASKS]
        for d in days_ago:
            when = now - timedelta(days=d, hours=rng.randint(0, 8), minutes=rng.randint(0, 59))
            with database.session() as db:
                ts = TrainingSession(
                    user_id=user_id,
                    task_id=rng.choice(task_ids),
                    status=SessionStatus.UPLOADED.value,
                    created_at=when,
                    uploaded_at=when,
                )
                db.add(ts)
                db.commit()
                session_id = ts.id
            pipeline.run_until_idle()
            _backdate(database, session_id, when)

        for filename, sample_task_id, d in samples:
            when = now - timedelta(days=d, hours=2)
            content = json.loads((SEED_DIR / "reports" / filename).read_text(encoding="utf-8"))
            content["student"] = name
            content["recordedAt"] = when.isoformat() + "Z"
            content["dateTime"] = when.strftime("%b %d, %Y · %H:%M UTC")
            with database.session() as db:
                ts = TrainingSession(
                    user_id=user_id,
                    task_id=sample_task_id,
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
