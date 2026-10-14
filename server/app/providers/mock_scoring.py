"""Stand-in for the video scoring API.

Produces plausible, deterministic (per session id) raw scoring in the schemaVersion 1
shape documented in ``providers.base``. It never looks at the video content.
"""

from __future__ import annotations

import random
import time
from typing import Any

from .base import ScoringContext
from .dimensions import DIMENSIONS


def _clamp(v: float, lo: int = 30, hi: int = 98) -> int:
    return int(max(lo, min(hi, round(v))))


class MockScoringProvider:
    name = "mock"

    def __init__(self, delay_s: float = 0.0):
        self.delay_s = delay_s

    def score(self, ctx: ScoringContext) -> dict[str, Any]:
        if self.delay_s > 0:
            time.sleep(self.delay_s)

        rng = random.Random(ctx.session_id)
        duration = ctx.duration_s if ctx.duration_s and ctx.duration_s > 0 else rng.uniform(85, 150)

        wrong_tool = rng.random() < 0.25
        long_pause = rng.random() < 0.4
        failed_insertions = rng.choice([0, 0, 1, 1, 2])
        knot_loose = rng.random() < 0.2
        needle_drop = rng.random() < 0.12
        completed = rng.random() < 0.88

        events: list[dict[str, Any]] = []

        def add(frac: float, severity: str, code: str, label: str, detail: str, clip: bool = False):
            events.append(
                {
                    "t": round(duration * frac, 1),
                    "severity": severity,
                    "code": code,
                    "label": label,
                    "detail": detail,
                    "clip": clip,
                }
            )

        add(0.02, "normal", "task_start", "Task start detected", "Session onset marker.", True)
        if wrong_tool:
            add(
                0.05,
                "error",
                "wrong_tool",
                "Wrong tool in left hand",
                "Observed tool: scissors. Expected tool: forceps.",
                True,
            )
            add(0.08, "normal", "tool_corrected", "Switched to correct tool", "Forceps picked up.")
        add(
            0.12,
            "normal",
            "needle_pickup",
            "Needle pickup completed",
            "Needle grasp stabilized within expected angle range.",
            True,
        )
        add(
            0.24,
            "normal",
            "needle_positioning",
            "Proper needle positioning detected",
            "Needle tip orientation aligned with target entry zone.",
        )
        if long_pause:
            add(
                0.33,
                "warning",
                "long_pause",
                "Long pause detected",
                f"Idle time exceeded cohort benchmark by {rng.uniform(1.5, 4.5):.1f}s before insertion.",
                True,
            )
        for i in range(failed_insertions):
            add(
                0.40 + i * 0.06,
                "warning",
                "insertion_retry",
                f"Insertion attempt {i + 1} unsuccessful",
                "Needle was withdrawn and re-angled before penetration.",
                True,
            )
        add(
            0.40 + failed_insertions * 0.06 + 0.04,
            "normal",
            "insertion_success",
            "Needle insertion completed",
            "Entry and exit points within tolerance.",
            True,
        )
        if needle_drop:
            add(
                0.58,
                "error",
                "needle_drop",
                "Needle dropped",
                "Needle left the needle holder and was retrieved from the field.",
                True,
            )
        for i, frac in enumerate((0.66, 0.73, 0.80), start=1):
            add(frac, "normal", f"knot_throw_{i}", f"Knot throw {i} completed", "Throw laid flat.")
        if knot_loose:
            add(
                0.84,
                "warning",
                "knot_loose",
                "Knot tension low",
                "Final knot appears loose; square configuration not confirmed.",
                True,
            )
        notes: list[str] = []
        if completed:
            add(0.95, "normal", "task_complete", "Task completed", "All required steps observed.", True)
        else:
            add(
                0.90,
                "error",
                "recording_interrupted",
                "Recording interrupted",
                "Video ends before the task was completed.",
                True,
            )
            notes.append("The recording ends before the task was completed; later steps could not be scored.")
        if not ctx.duration_s:
            notes.append("Video duration was not reported by the client; timestamps are estimated.")
        events.sort(key=lambda e: e["t"])

        skill = rng.uniform(58, 88)

        def jitter() -> float:
            return rng.uniform(-8, 8)

        scores = {
            "efficiency": skill + jitter() - 5 * long_pause - 3 * failed_insertions,
            "accuracy": skill + jitter() - 6 * failed_insertions,
            "procedural_flow": skill + jitter() - 8 * wrong_tool - 10 * (not completed),
            "safety": skill + 6 + jitter() - 10 * wrong_tool - 12 * needle_drop - 3 * failed_insertions,
            "product_quality": skill + jitter() - 8 * knot_loose - 10 * (not completed),
        }
        metrics = {
            "efficiency": {
                "idleRatio": round(rng.uniform(0.05, 0.25) + 0.08 * long_pause, 2),
                "pathLengthCm": round(rng.uniform(180, 320), 0),
            },
            "accuracy": {
                "entryDeviationMm": round(rng.uniform(0.6, 2.4) + 0.5 * failed_insertions, 1),
                "insertionAttempts": failed_insertions + 1,
            },
            "procedural_flow": {
                "stepsCompleted": 7 if completed else 5,
                "stepsTotal": 7,
                "reworkCount": failed_insertions + int(wrong_tool),
            },
            "safety": {"needleDrops": int(needle_drop), "wrongToolEvents": int(wrong_tool)},
            "product_quality": {
                "stitchSpacingCvPct": round(rng.uniform(6, 22), 1),
                "knotThrows": 3,
            },
        }
        dimensions = [
            {"key": d.key, "score": _clamp(scores[d.key]), "metrics": metrics[d.key]} for d in DIMENSIONS
        ]
        overall = round(sum(d["score"] for d in dimensions) / len(dimensions))
        confidence = rng.uniform(0.6, 0.92) - 0.15 * (not completed) - 0.1 * (not ctx.duration_s)

        return {
            "schemaVersion": 1,
            "overallScore": overall,
            "confidence": round(max(0.3, confidence), 2),
            "completed": completed,
            "durationSeconds": round(duration, 1),
            "dimensions": dimensions,
            "events": events,
            "notes": notes,
        }
