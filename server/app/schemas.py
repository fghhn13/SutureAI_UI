"""API response/request models (camelCase on the wire to match the React app)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    @field_serializer("*", when_used="json", check_fields=False)
    def _utc(self, value):
        # Timestamps are stored as naive UTC; make that explicit for the browser.
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.isoformat() + "Z"
        return value


class UserOut(ApiModel):
    id: int
    email: str
    display_name: str
    role: str


class LoginIn(ApiModel):
    email: str
    password: str


class TaskOut(ApiModel):
    id: str
    name: str
    description: str
    estimated_duration: str | None
    dimensions: list[str]


class VideoOut(ApiModel):
    original_filename: str | None
    mime_type: str
    size_bytes: int
    duration_s: float | None
    url: str


class SessionOut(ApiModel):
    id: str
    status: str
    error: str | None
    progress: float | None
    stage: str | None
    task: TaskOut
    video: VideoOut | None
    overall_score: int | None
    created_at: datetime
    uploaded_at: datetime | None
    finished_at: datetime | None


class CreateSessionIn(ApiModel):
    task_id: str


class ReportListItem(ApiModel):
    session_id: str
    label: str
    task_name: str
    overall_score: int
    recorded_at: datetime


class ReviewIn(ApiModel):
    final_score: int = Field(ge=0, le=100)
    comment: str = Field(default="", max_length=5000)
    teaching_focus: list[str] = Field(default_factory=list, max_length=10)
    complete: bool = False


class AcceptIn(ApiModel):
    message: str = Field(default="", max_length=2000)


class AppealIn(ApiModel):
    event_id: str | None = None  # None = the report as a whole
    reason: str
    message: str = Field(max_length=5000)


class AppealDecisionIn(ApiModel):
    decision: Literal["accept", "reject"]
    note: str = Field(max_length=5000)
    score_adjustment: int | None = None  # accept only; defaults to the suggested value


class NoteIn(ApiModel):
    note: str = Field(default="", max_length=5000)
