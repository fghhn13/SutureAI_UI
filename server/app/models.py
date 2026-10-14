"""SQLAlchemy models. All timestamps are naive UTC."""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def new_id() -> str:
    return uuid.uuid4().hex


class SessionStatus(str, enum.Enum):
    """Training session lifecycle.

    created -> uploaded -> scoring -> scored -> generating -> ready
                              \\___________\\_____________-> failed
    """

    CREATED = "created"
    UPLOADED = "uploaded"
    SCORING = "scoring"
    SCORED = "scored"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


class Role(str, enum.Enum):
    STUDENT = "student"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


STAFF_ROLES = {Role.INSTRUCTOR.value, Role.ADMIN.value}

# A student belongs to one cohort (unique user_id); an instructor may teach several.
cohort_members = Table(
    "cohort_members",
    Base.metadata,
    Column("cohort_id", ForeignKey("cohorts.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, unique=True),
)

cohort_instructors = Table(
    "cohort_instructors",
    Base.metadata,
    Column("cohort_id", ForeignKey("cohorts.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Cohort(Base):
    """A class/group of students taught by one or more instructors."""

    __tablename__ = "cohorts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    course_name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    students: Mapped[list[User]] = relationship(secondary=cohort_members, order_by="User.display_name")
    instructors: Mapped[list[User]] = relationship(secondary=cohort_instructors)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), default="student")  # student | instructor | admin
    # Lightweight profile until courses/assignments get their own tables.
    course_name: Mapped[str | None] = mapped_column(String(200))
    training_focus: Mapped[str | None] = mapped_column(String(300))
    current_task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"))
    current_task_due: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    current_task: Mapped[Task | None] = relationship()
    cohort: Mapped[Cohort | None] = relationship(secondary=cohort_members, viewonly=True)
    teaching: Mapped[list[Cohort]] = relationship(
        secondary=cohort_instructors, viewonly=True, order_by="Cohort.name"
    )

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES


class AuthSession(Base):
    """Server-side login session; the id is the opaque cookie value."""

    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime]

    user: Mapped[User] = relationship()


class Task(Base):
    """A kind of training exercise a student can record (e.g. simple suturing)."""

    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    estimated_duration: Mapped[str | None] = mapped_column(String(40))
    dimensions: Mapped[list[str]] = mapped_column(JSON, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"))
    status: Mapped[str] = mapped_column(String(20), default=SessionStatus.CREATED.value, index=True)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)
    uploaded_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]

    user: Mapped[User] = relationship()
    task: Mapped[Task] = relationship()
    video: Mapped[Video | None] = relationship(back_populates="session", uselist=False)
    scoring: Mapped[ScoringResult | None] = relationship(back_populates="session", uselist=False)
    report: Mapped[Report | None] = relationship(back_populates="session", uselist=False)
    review: Mapped[InstructorReview | None] = relationship(back_populates="session", uselist=False)
    feedback: Mapped[StudentFeedback | None] = relationship(back_populates="session", uselist=False)
    note: Mapped[StudentNote | None] = relationship(uselist=False)


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), unique=True
    )
    # Relative to settings.video_dir.
    path: Mapped[str] = mapped_column(String(500))
    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    duration_s: Mapped[float | None] = mapped_column(Float)
    sha256: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    session: Mapped[TrainingSession] = relationship(back_populates="video")


class ScoringResult(Base):
    """Raw output of the video scoring provider (kept so reports can be regenerated)."""

    __tablename__ = "scoring_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), unique=True
    )
    provider: Mapped[str] = mapped_column(String(50))
    overall_score: Mapped[int] = mapped_column(Integer)
    raw: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    session: Mapped[TrainingSession] = relationship(back_populates="scoring")


class Report(Base):
    """Final report document; ``content`` follows the shape TrainingReportPage renders."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), unique=True
    )
    generator: Mapped[str] = mapped_column(String(50))  # template | llm | seed
    overall_score: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    session: Mapped[TrainingSession] = relationship(back_populates="report")


class ReviewStatus(str, enum.Enum):
    DRAFT = "draft"  # saved by the instructor, not visible to the student
    COMPLETED = "completed"


class InstructorReview(Base):
    """Instructor's evaluation of a session's report (one per session)."""

    __tablename__ = "instructor_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), unique=True
    )
    instructor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default=ReviewStatus.DRAFT.value)
    ai_score: Mapped[int] = mapped_column(Integer)
    final_score: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    teaching_focus: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None]

    session: Mapped[TrainingSession] = relationship(back_populates="review")
    instructor: Mapped[User] = relationship()

    @property
    def alignment(self) -> str:
        diff = abs(self.final_score - self.ai_score)
        if diff == 0:
            return "agree"
        return "adjusted" if diff <= 10 else "override"


class FeedbackKind(str, enum.Enum):
    ACCEPT = "accept"
    CLARIFY = "clarify"


class FeedbackStatus(str, enum.Enum):
    OPEN = "open"  # clarification waiting for the instructor
    RESOLVED = "resolved"


class StudentFeedback(Base):
    """Student's response to a report: accept it, or ask for clarification (one per session)."""

    __tablename__ = "student_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), unique=True
    )
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text, default="")
    referenced_clip: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    response: Mapped[str | None] = mapped_column(Text)
    responded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    responded_at: Mapped[datetime | None]

    session: Mapped[TrainingSession] = relationship(back_populates="feedback")
    responded_by: Mapped[User | None] = relationship(foreign_keys=[responded_by_id])


class StudentNote(Base):
    """Private reflection a student keeps on their own report (not shown to instructors)."""

    __tablename__ = "student_notes"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("training_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    note: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)
