"""Scoring dimensions and the canned wording the template report uses for them."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Dimension:
    key: str
    name: str
    metrics: str
    high: str
    mid: str
    low: str
    strength: str
    weakness: str
    suggestion: str


DIMENSIONS: list[Dimension] = [
    Dimension(
        key="efficiency",
        name="Efficiency",
        metrics="duration, path length, idle ratio",
        high="Duration and motion efficiency are above baseline.",
        mid="Pace is close to baseline; some idle time between steps.",
        low="Long pauses and extra motion slowed the task noticeably.",
        strength="Efficient pacing with little idle time between steps.",
        weakness="Idle time and extra motion lengthened the task.",
        suggestion="Rehearse the step sequence before recording to cut pauses between steps.",
    ),
    Dimension(
        key="accuracy",
        name="Accuracy",
        metrics="entry/exit deviation, stitch spacing",
        high="Entry and exit points landed consistently on target.",
        mid="Insertion precision varied during mid-task attempts.",
        low="Repeated insertion attempts and uneven spacing reduced precision.",
        strength="Precise needle entry and exit placement.",
        weakness="Needle insertion precision is inconsistent.",
        suggestion="Mark entry and exit points and practise single, controlled insertions.",
    ),
    Dimension(
        key="procedural_flow",
        name="Procedural Flow",
        metrics="step completeness, step order, rework count",
        high="Step order and completion quality are strong.",
        mid="Steps were completed with occasional rework.",
        low="Steps were out of order or repeated several times.",
        strength="Clear, well-ordered procedural flow.",
        weakness="Step order and rework need attention.",
        suggestion="Review the procedure checklist and follow it step by step in the next session.",
    ),
    Dimension(
        key="safety",
        name="Safety",
        metrics="needle drop, tool out of region, repeated attempts",
        high="No safety incidents detected.",
        mid="No critical incidents, but repeated attempts occurred.",
        low="Safety-relevant incidents were detected (tool or needle handling).",
        strength="Safe instrument handling throughout.",
        weakness="Instrument handling raised safety flags.",
        suggestion="Slow down instrument hand-offs and confirm the correct tool before each step.",
    ),
    Dimension(
        key="product_quality",
        name="Product Quality",
        metrics="stitch consistency, knot quality proxy",
        high="Stitches and knots look consistent and secure.",
        mid="Knot and stitch consistency need additional practice.",
        low="Stitch spacing and knot security are below target.",
        strength="Consistent stitch spacing and secure knots.",
        weakness="Stitch and knot consistency are below target.",
        suggestion="Practise square knots and even stitch spacing on a pad before the next recording.",
    ),
]

DIMENSIONS_BY_KEY = {d.key: d for d in DIMENSIONS}


def band_text(dim: Dimension, score: int) -> str:
    if score >= 80:
        return dim.high
    if score >= 65:
        return dim.mid
    return dim.low
