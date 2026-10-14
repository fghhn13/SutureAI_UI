"""Provider contracts for the two external steps of the pipeline.

Scoring output ("raw scoring", stored in ``scoring_results.raw``) — schemaVersion 1::

    {
      "schemaVersion": 1,
      "overallScore": 74,                 # 0-100
      "confidence": 0.71,                 # 0-1, model's confidence in its own scoring
      "completed": true,                  # did the student finish the task on video
      "durationSeconds": 102.4,
      "dimensions": [                     # keys from providers.dimensions.DIMENSIONS
        {"key": "efficiency", "score": 78, "metrics": {"idleRatio": 0.12, ...}}
      ],
      "events": [                         # detected moments, seconds from video start
        {"t": 12.0, "severity": "normal|warning|error", "code": "needle_pickup",
         "label": "Needle pickup completed", "detail": "...", "clip": true}
      ],
      "notes": ["Recording ended before ..."]   # caveats for the uncertainty section
    }

A real scoring API adapter should translate its response into this shape so the
report step does not care where scores came from.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol


@dataclass(frozen=True)
class ScoringContext:
    session_id: str
    task_id: str
    task_name: str
    video_path: Path | None
    duration_s: float | None


@dataclass(frozen=True)
class ReportContext:
    session_id: str
    task_name: str
    student_name: str
    recorded_at: datetime
    scoring: dict[str, Any]
    previous_score: int | None
    evidence_video_url: str | None


class ScoringProvider(Protocol):
    name: str

    def score(self, ctx: ScoringContext) -> dict[str, Any]: ...


class ReportProvider(Protocol):
    name: str

    def generate(self, ctx: ReportContext) -> dict[str, Any]: ...
