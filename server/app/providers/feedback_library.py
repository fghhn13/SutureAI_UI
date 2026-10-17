"""Event-specific coaching text (English + Chinese) used by the template report.

Generic, score-band wording reads as vague ("insertion precision varied"). Feedback keyed
on what was actually detected (``code`` from the scoring output) can say *why* it cost
points and give a concrete drill. ``impact`` is the default points lost when the scoring
provider doesn't report one per event.
"""

from __future__ import annotations

import re
from typing import Any

# Issue events: coaching text. Keys: impact (int), en / zh: title, why, drill.
ISSUES: dict[str, dict[str, Any]] = {
    "wrong_tool": {
        "impact": 7,
        "en": {
            "title": "Picked up the wrong instrument",
            "why": "Starting with the wrong tool breaks the procedure order and costs time and safety points.",
            "drill": "Lay instruments out in a fixed order and name each one before you pick it up.",
        },
        "zh": {
            "title": "拿错了器械",
            "why": "用错器械开局会打乱操作顺序，同时扣流程规范和安全分。",
            "drill": "器械按固定顺序摆放，拿起前先说出器械名称再操作。",
        },
    },
    "threading_failed": {
        "impact": 5,
        "en": {
            "title": "Threading needed more than one attempt",
            "why": "Each failed pass adds time and shows unstable hand control near the needle eye.",
            "drill": "Rest both wrists on the table and bring the thread to the needle, not the needle to the thread. Do 10 reps.",
        },
        "zh": {
            "title": "穿针不止一次才成功",
            "why": "每次失败都会拖长时间，也说明靠近针孔时手部控制不稳。",
            "drill": "双手手腕贴住桌面，用线去找针，而不是用针去找线，连续练 10 次。",
        },
    },
    "insertion_retry": {
        "impact": 4,
        "en": {
            "title": "Needle was re-inserted",
            "why": "Withdrawing and re-angling the needle reduces accuracy and damages tissue.",
            "drill": "Mark the entry point, set the needle at 90° before touching the pad, then follow its curve in one motion.",
        },
        "zh": {
            "title": "出现重复进针",
            "why": "退针后重新调整角度会降低准确性，也会损伤组织。",
            "drill": "先标出进针点，接触练习垫前把针调到 90°，再顺着针的弧度一次进针。",
        },
    },
    "needle_drop": {
        "impact": 8,
        "en": {
            "title": "Needle was dropped",
            "why": "A dropped needle is a safety incident and interrupts the procedure.",
            "drill": "Grip the needle one-third from the swaged end and lock the needle holder fully before moving.",
        },
        "zh": {
            "title": "掉针",
            "why": "掉针属于安全事件，还会打断操作流程。",
            "drill": "在针尾三分之一处夹针，移动前把持针器完全锁紧。",
        },
    },
    "long_pause": {
        "impact": 3,
        "en": {
            "title": "Long pause before the next step",
            "why": "Idle time beyond the benchmark lowers the efficiency score.",
            "drill": "Say the next step out loud before finishing the current one, so your hands are already moving.",
        },
        "zh": {
            "title": "进入下一步前停顿过长",
            "why": "超过基准的空闲时间会拉低效率分。",
            "drill": "当前步骤快结束时先说出下一步，让手提前进入下一个动作。",
        },
    },
    "knot_loose": {
        "impact": 4,
        "en": {
            "title": "Final knot is loose",
            "why": "A loose or non-square knot may slip, which lowers the product quality score.",
            "drill": "Tie 10 square knots on the pad, alternating throw direction and pulling each throw flat.",
        },
        "zh": {
            "title": "最后的线结不够紧",
            "why": "线结松或不是方结可能滑脱，会拉低成品质量分。",
            "drill": "在练习垫上连打 10 个方结，每次交替方向，并把每个结拉平。",
        },
    },
    "recording_interrupted": {
        "impact": 6,
        "en": {
            "title": "Recording stopped before the task was finished",
            "why": "Steps after the cut can't be assessed, so they count as incomplete.",
            "drill": "Check storage and battery before you start, and record the whole task in one take.",
        },
        "zh": {
            "title": "任务完成前录像中断",
            "why": "中断之后的步骤无法评估，只能按未完成计算。",
            "drill": "开始前检查存储空间和电量，整个任务一次录完。",
        },
    },
}

# Chinese titles for normal steps (and issues' default labels), by event code.
LABELS_ZH: dict[str, str] = {
    "task_start": "检测到任务开始",
    "tool_corrected": "换成了正确的器械",
    "needle_pickup": "完成夹针",
    "needle_positioning": "针的位置调整到位",
    "threading_attempt": "尝试穿针",
    "threading_success": "穿针成功",
    "insertion_success": "完成进针",
    "knot_start": "开始打结",
    "segment_complete": "本段完成",
    "task_complete": "任务完成",
    "wrong_tool": "左手拿错器械",
    "threading_failed": "穿针失败",
    "insertion_retry": "进针未成功，重新进针",
    "needle_drop": "掉针",
    "long_pause": "停顿过长",
    "knot_loose": "线结张力不足",
    "recording_interrupted": "录像中断",
}

_KNOT_THROW = re.compile(r"^knot_throw_(\d+)$")


def label_zh(code: str) -> str | None:
    m = _KNOT_THROW.match(code)
    if m:
        return f"第 {m.group(1)} 个结完成"
    return LABELS_ZH.get(code)


# Measurable checks shown as "value vs target": (dimension key, metric, labels, kind, target)
# kind: "max" (value must be <= target), "eq" (== target), "ratio" (0..1 shown as %, <= target)
METRIC_CHECKS: list[tuple[str, str, dict[str, str], str, float]] = [
    ("efficiency", "idleRatio", {"en": "Idle time", "zh": "空闲时间占比"}, "ratio", 0.12),
    ("accuracy", "threadingAttempts", {"en": "Threading attempts", "zh": "穿针次数"}, "eq", 1),
    ("accuracy", "insertionAttempts", {"en": "Insertion attempts", "zh": "进针次数"}, "eq", 1),
    ("safety", "wrongToolEvents", {"en": "Wrong-tool pickups", "zh": "拿错器械次数"}, "eq", 0),
    ("safety", "needleDrops", {"en": "Needle drops", "zh": "掉针次数"}, "eq", 0),
    ("procedural_flow", "reworkCount", {"en": "Rework", "zh": "返工次数"}, "eq", 0),
    ("product_quality", "stitchSpacingCvPct", {"en": "Stitch spacing variation", "zh": "针距变异"}, "max", 10),
]
