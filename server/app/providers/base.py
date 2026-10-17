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
      "notes": ["Recording ended before ..."],  # caveats for the uncertainty section
      "narrative": {...}                        # optional: hand-written report text that
    }                                           # overrides the template (demo recordings)

A real scoring API adapter should translate its response into this shape so the
report step does not care where scores came from.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

# Processing stages, in order. Providers report progress against these keys; the UI
# (src/api/sessionStatus.js) shows a label and live detail lines for each.
SCORING_STAGES = ["verify", "detect_instruments", "track_hands", "segment_steps", "score_dimensions"]
REPORT_STAGES = ["write_report", "link_evidence"]
STAGES = SCORING_STAGES + REPORT_STAGES

# progress(fraction_of_this_step 0..1, stage_key)
ProgressFn = Callable[[float, str], None]


class UserFacingError(Exception):
    """A provider failure whose message is shown to the student as-is."""


def _no_progress(_fraction: float, _stage: str) -> None:
    pass


def run_stages(progress: ProgressFn, stages: list[str], total_s: float, sleep) -> None:
    """Walk through ``stages`` over ``total_s`` seconds, reporting progress ~4x per second."""
    if total_s <= 0:
        return
    per_stage = total_s / len(stages)
    ticks = max(1, int(per_stage * 4))
    for i, stage in enumerate(stages):
        for t in range(ticks):
            progress((i + t / ticks) / len(stages), stage)
            sleep(per_stage / ticks)
    progress(1.0, stages[-1])


@dataclass(frozen=True)
class ScoringContext:
    session_id: str
    task_id: str
    task_name: str
    video_path: Path | None
    duration_s: float | None
    video_sha256: str | None = None
    original_filename: str | None = None
    progress: ProgressFn = field(default=_no_progress, compare=False)


@dataclass(frozen=True)
class ReportContext:
    session_id: str
    task_name: str
    student_name: str
    recorded_at: datetime
    scoring: dict[str, Any]
    previous_score: int | None
    evidence_video_url: str | None
    progress: ProgressFn = field(default=_no_progress, compare=False)
    # Dimension key -> score from the student's previous report, for "since last time".
    previous_dimensions: dict[str, int] | None = None


class ScoringProvider(Protocol):
    name: str

    def score(self, ctx: ScoringContext) -> dict[str, Any]: ...


class ReportProvider(Protocol):
    name: str

    def generate(self, ctx: ReportContext) -> dict[str, Any]: ...
