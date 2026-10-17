"""Scoring dimensions and the canned wording the template report uses for them."""

from __future__ import annotations

from dataclasses import dataclass, field


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
    # Same fields in Chinese (name, high, mid, low, strength, weakness, suggestion).
    zh: dict[str, str] = field(default_factory=dict)

    def text(self, attr: str, lang: str = "en") -> str:
        if lang == "zh" and attr in self.zh:
            return self.zh[attr]
        return getattr(self, attr)


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
        zh={
            "name": "效率",
            "high": "用时和动作效率优于基准。",
            "mid": "节奏接近基准，步骤之间有一些空闲。",
            "low": "停顿和多余动作明显拖慢了操作。",
            "strength": "节奏紧凑，步骤之间几乎没有空闲。",
            "weakness": "空闲时间和多余动作拉长了操作时间。",
            "suggestion": "录制前先把步骤顺序过一遍，减少步骤之间的停顿。",
        },
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
        zh={
            "name": "准确性",
            "high": "进针点和出针点稳定落在目标位置。",
            "mid": "中段操作时进针精度有波动。",
            "low": "反复进针、针距不均，精度偏低。",
            "strength": "进针、出针位置精准。",
            "weakness": "进针精度不稳定。",
            "suggestion": "先标出进针点和出针点，练习一次到位的进针。",
        },
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
        zh={
            "name": "流程规范",
            "high": "步骤顺序正确，完成质量好。",
            "mid": "步骤基本完成，偶有返工。",
            "low": "步骤顺序混乱或多次重复。",
            "strength": "步骤清晰，顺序规范。",
            "weakness": "步骤顺序和返工需要注意。",
            "suggestion": "下次录制前对照操作清单，按步骤逐一完成。",
        },
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
        zh={
            "name": "安全性",
            "high": "未发现安全问题。",
            "mid": "没有严重问题，但出现了重复尝试。",
            "low": "出现了器械或持针相关的安全问题。",
            "strength": "全程器械操作安全。",
            "weakness": "器械操作存在安全隐患。",
            "suggestion": "放慢器械交接，每一步开始前先确认手里的器械。",
        },
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
        zh={
            "name": "成品质量",
            "high": "缝线和线结整齐、牢固。",
            "mid": "线结和缝线一致性还需练习。",
            "low": "针距和线结牢固度低于目标。",
            "strength": "针距均匀，线结牢固。",
            "weakness": "缝线和线结一致性低于目标。",
            "suggestion": "下次录制前在练习垫上多练方结和均匀针距。",
        },
    ),
]

DIMENSIONS_BY_KEY = {d.key: d for d in DIMENSIONS}


def band_text(dim: Dimension, score: int, lang: str = "en") -> str:
    if score >= 80:
        return dim.text("high", lang)
    if score >= 65:
        return dim.text("mid", lang)
    return dim.text("low", lang)
