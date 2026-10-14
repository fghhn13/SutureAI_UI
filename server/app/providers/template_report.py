"""Rule-based report writer: raw scoring -> report document.

Stand-in for the LLM step. The output shape is what ``TrainingReportPage.jsx`` renders
(same keys as the seed reports in ``server/seed/reports``), so an LLM provider must
return the same structure.
"""

from __future__ import annotations

import time
from typing import Any

from .base import ReportContext
from .dimensions import DIMENSIONS_BY_KEY, band_text

_SEVERITY_TO_CLIP_TYPE = {"error": "Error", "warning": "Warning", "normal": "Step"}


def format_clock(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 60}:{s % 60:02d}"


def format_duration(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 60}m {s % 60:02d}s" if s >= 60 else f"{s}s"


def reliability_label(confidence: float) -> str:
    if confidence >= 0.8:
        return "High Confidence"
    if confidence >= 0.6:
        return "Medium Confidence"
    return "Low Confidence"


class TemplateReportProvider:
    name = "template"

    def __init__(self, delay_s: float = 0.0):
        self.delay_s = delay_s

    def generate(self, ctx: ReportContext) -> dict[str, Any]:
        if self.delay_s > 0:
            time.sleep(self.delay_s)

        raw = ctx.scoring
        overall = int(raw["overallScore"])
        confidence = float(raw.get("confidence", 0.6))
        completed = bool(raw.get("completed", True))
        events = raw.get("events", [])

        dims = []
        for d in raw["dimensions"]:
            meta = DIMENSIONS_BY_KEY.get(d["key"])
            if meta is None:
                continue
            dims.append((meta, int(d["score"])))
        ranked = sorted(dims, key=lambda pair: pair[1], reverse=True)
        best, worst = ranked[0], ranked[-1]

        timeline = [
            {
                "id": f"e{i}",
                "time": format_clock(e["t"]),
                "timeSeconds": e["t"],
                "title": e["label"],
                "type": e["severity"],
                "detail": e.get("detail", ""),
                "clip": bool(e.get("clip")),
            }
            for i, e in enumerate(events, start=1)
        ]
        clip_events = [e for e in events if e.get("clip")]
        clips = [
            {
                "id": f"c{i}",
                "time": format_clock(e["t"]),
                "timeSeconds": e["t"],
                "type": _SEVERITY_TO_CLIP_TYPE.get(e["severity"], "Step"),
                "label": e["label"],
                "description": e.get("detail", ""),
            }
            for i, e in enumerate(clip_events, start=1)
        ]
        issues = [e for e in events if e["severity"] in {"warning", "error"}]
        errors = [e for e in issues if e["severity"] == "error"]

        strengths = [meta.strength for meta, score in ranked[:2] if score >= 70] or [best[0].strength]
        weaknesses = [meta.weakness for meta, score in ranked[-2:][::-1] if score < 80]
        suggestions = [meta.suggestion for meta, score in ranked[-2:][::-1]]
        if not completed:
            weaknesses.append("The recording ended before the task was completed.")
            suggestions.append("Record the full task end-to-end so every step can be reviewed.")
        if not weaknesses:
            weaknesses.append(f"{worst[0].name} is the relatively weakest dimension.")

        if ctx.previous_score is None:
            delta = "—"
            delta_sentence = "This is your first scored session for comparison."
        else:
            diff = overall - ctx.previous_score
            delta = f"{diff:+d}"
            delta_sentence = (
                f"That is {abs(diff)} points {'above' if diff >= 0 else 'below'} your previous session."
                if diff
                else "That matches your previous session."
            )

        main_issue = errors[0]["label"] if errors else worst[0].weakness.rstrip(".")
        summary = (
            f"{best[0].name} is your strongest area ({best[1]}); "
            f"{worst[0].name.lower()} needs the most work ({worst[1]})."
        )

        uncertainty = list(raw.get("notes", []))
        if confidence < 0.6:
            uncertainty.append(
                "Scoring confidence is low (camera angle, lighting or occlusion); "
                "treat the scores as indicative until an instructor confirms them."
            )
        elif not uncertainty:
            uncertainty.append("No major uncertainty sources detected in this recording.")

        return {
            "evidencePreviewUrl": None,
            "evidenceVideoUrl": ctx.evidence_video_url,
            "productName": "SutureAI",
            "reportTitle": "Training Report",
            "task": ctx.task_name,
            "student": ctx.student_name,
            "recordedAt": ctx.recorded_at.isoformat() + "Z",
            "dateTime": ctx.recorded_at.strftime("%b %d, %Y · %H:%M UTC"),
            "status": "Pending Instructor Review",
            "overallScore": overall,
            "reliability": reliability_label(confidence),
            "completed": completed,
            "duration": format_duration(float(raw.get("durationSeconds", 0))),
            "delta": delta,
            "summary": summary,
            "dimensions": [
                {
                    "name": meta.name,
                    "score": score,
                    "explanation": band_text(meta, score),
                    "metrics": meta.metrics,
                }
                for meta, score in dims
            ],
            "timeline": timeline,
            "clips": clips,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "suggestions": suggestions,
            "assessmentHighlights": {
                "strongestDimension": best[0].name,
                "mainIssue": main_issue,
                "practiceFocus": worst[0].name,
                "evidenceClipCount": len(clips),
                "reviewStatus": "Pending instructor review",
            },
            "aiFeedback": [
                f"Overall score {overall}/100. {delta_sentence}",
                f"{len(issues)} issue(s) flagged in the recording"
                + (f", including {len(errors)} error(s)." if errors else "."),
                f"Focus next on {worst[0].name.lower()}: {worst[0].suggestion[0].lower()}{worst[0].suggestion[1:]}",
            ],
            "instructorEvaluation": {
                "instructorName": "Unassigned",
                "evaluationStatus": "Awaiting instructor review",
                "comment": "",
                "finalScore": "",
            },
            "instructorReview": {
                "reviewStatus": "Not Started",
                "aiSuggestedScore": overall,
                "finalConfirmedScore": overall,
                "adjustedScore": 0,
                "alignmentWithAi": "Pending",
                "teacherComment": "",
                "teachingFocus": [worst[0].name.lower()],
            },
            "studentObjection": {
                "submitted": False,
                "resolutionStatus": "Closed",
                "concernText": "",
                "referencedClip": "",
                "teacherResponse": "",
            },
            "studentResponse": {
                "helperText": "You may raise concerns if you believe a segment was misinterpreted.",
                "acceptLabel": "Accept Feedback",
                "clarifyLabel": "Request Clarification",
            },
            "personalNote": "",
            "uncertainty": uncertainty,
            "instructorNote": "",
            "reviewStatus": "Awaiting instructor confirmation",
        }
