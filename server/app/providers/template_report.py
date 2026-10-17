"""Rule-based report writer: raw scoring -> report document.

Stand-in for the LLM step. The output shape is what ``TrainingReportPage.jsx`` renders
(same keys as the seed reports in ``server/seed/reports``), so an LLM provider must
return the same structure.

The report leads with one thing to fix (``focus``), says where the points went
(``pointsLost``), and ties feedback to moments in the video, because generic,
score-band wording was reported as too vague. Text is generated in English; Chinese
overrides go in ``i18n.zh`` and are merged in per request (services.reviews.report_view).
"""

from __future__ import annotations

import time
from typing import Any

from .base import REPORT_STAGES, ReportContext, run_stages
from .dimensions import DIMENSIONS_BY_KEY, band_text
from .feedback_library import ISSUES, METRIC_CHECKS, label_zh

LANGS = ("en", "zh")

# Hand-written narrative keys that replace generated text (annotated demo recordings).
NARRATIVE_KEYS = {
    "summary",
    "strengths",
    "weaknesses",
    "suggestions",
    "aiFeedback",
    "uncertainty",
    "assessmentHighlights",
    "duration",
}

TASK_NAMES_ZH = {
    "Simple Suturing Practice": "简单缝合练习",
    "Knot Tying Basics": "打结基础",
    "Needle Handling": "持针操作",
}

_SEVERITY_TO_CLIP_TYPE = {"error": "Error", "warning": "Warning", "normal": "Step"}
_SEVERITY_RANK = {"error": 0, "warning": 1, "normal": 2}
MAX_SUGGESTIONS = 3


def format_clock(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 60}:{s % 60:02d}"


def format_duration(seconds: float, lang: str = "en") -> str:
    s = int(round(seconds))
    if lang == "zh":
        return f"{s // 60}分{s % 60:02d}秒" if s >= 60 else f"{s}秒"
    return f"{s // 60}m {s % 60:02d}s" if s >= 60 else f"{s}s"


def reliability_label(confidence: float, lang: str = "en") -> str:
    level = "High" if confidence >= 0.8 else "Medium" if confidence >= 0.6 else "Low"
    if lang == "zh":
        return {"High": "高置信度", "Medium": "中等置信度", "Low": "低置信度"}[level]
    return f"{level} Confidence"


def _issue_text(code: str, event: dict[str, Any], lang: str) -> dict[str, str]:
    """title / why / drill for an issue event, from the library or the event itself."""
    lib = ISSUES.get(code, {}).get(lang)
    if lib:
        return lib
    title = (event.get("labelZh") or label_zh(code)) if lang == "zh" else None
    return {"title": title or event["label"], "why": event.get("detail", ""), "drill": ""}


def _event_impact(e: dict[str, Any]) -> float:
    if isinstance(e.get("impact"), (int, float)):
        return float(e["impact"])
    return float(ISSUES.get(e["code"], {}).get("impact", 3 if e["severity"] == "error" else 2))


def _group_issues(events: list[dict[str, Any]], lost: int) -> list[dict[str, Any]]:
    """Warning/error events grouped by code, with points lost (scaled to fit the total)."""
    groups: dict[str, dict[str, Any]] = {}
    for e in events:
        if e["severity"] not in {"warning", "error"}:
            continue
        g = groups.setdefault(
            e["code"],
            {"code": e["code"], "events": [], "points": 0.0, "severity": e["severity"]},
        )
        g["events"].append(e)
        g["points"] += _event_impact(e)
        if _SEVERITY_RANK[e["severity"]] < _SEVERITY_RANK[g["severity"]]:
            g["severity"] = e["severity"]
    total = sum(g["points"] for g in groups.values())
    scale = min(1.0, lost / total) if total else 1.0
    for g in groups.values():
        g["points"] = max(1, round(g["points"] * scale)) if lost > 0 else 0
    return sorted(groups.values(), key=lambda g: (-g["points"], _SEVERITY_RANK[g["severity"]], g["events"][0]["t"]))


def _metric_checks(raw_dims: list[dict[str, Any]], lang: str) -> list[dict[str, Any]]:
    by_key = {d["key"]: d.get("metrics") or {} for d in raw_dims}
    out = []
    for dim_key, metric, labels, kind, target in METRIC_CHECKS:
        value = by_key.get(dim_key, {}).get(metric)
        if not isinstance(value, (int, float)):
            continue
        if kind == "ratio":
            ok = value <= target
            display, target_display = f"{value * 100:.0f}%", f"≤ {target * 100:.0f}%"
        elif kind == "max":
            ok = value <= target
            display, target_display = f"{value:.0f}%", f"≤ {target:.0f}%"
        else:
            ok = value == target
            display, target_display = f"{value:g}", f"{target:g}"
        out.append(
            {
                "key": metric,
                "dimension": dim_key,
                "label": labels[lang],
                "value": value,
                "display": display,
                "target": target_display,
                "ok": ok,
            }
        )
    # Misses first; keep it short.
    out.sort(key=lambda m: m["ok"])
    return out[:4]


class TemplateReportProvider:
    name = "template"

    def __init__(self, delay_s: float = 0.0):
        self.delay_s = delay_s

    def generate(self, ctx: ReportContext) -> dict[str, Any]:
        run_stages(ctx.progress, REPORT_STAGES, self.delay_s, time.sleep)

        raw = ctx.scoring
        overall = int(raw["overallScore"])
        confidence = float(raw.get("confidence", 0.6))
        completed = bool(raw.get("completed", True))
        events = sorted(raw.get("events", []), key=lambda e: e["t"])
        duration_s = float(raw.get("durationSeconds", 0))

        dims = []
        for d in raw["dimensions"]:
            meta = DIMENSIONS_BY_KEY.get(d["key"])
            if meta is not None:
                dims.append((meta, int(d["score"])))
        ranked = sorted(dims, key=lambda pair: pair[1], reverse=True)
        best, worst = ranked[0], ranked[-1]

        issue_groups = _group_issues(events, max(0, 100 - overall))
        errors = [e for e in events if e["severity"] == "error"]
        issues = [e for e in events if e["severity"] in {"warning", "error"}]
        event_ids = {id(e): f"e{i}" for i, e in enumerate(events, start=1)}
        clip_events = [e for e in events if e.get("clip")]

        # ---- language-neutral structure ------------------------------------------
        top = issue_groups[0] if issue_groups else None
        focus: dict[str, Any] = (
            {
                "code": top["code"],
                "severity": top["severity"],
                "eventId": event_ids[id(top["events"][0])],
                "timeSeconds": top["events"][0]["t"],
                "times": [e["t"] for e in top["events"]],
                "impact": top["points"],
            }
            if top
            else {"code": None, "dimension": worst[0].key, "impact": None}
        )
        points_lost = [
            {"code": g["code"], "points": g["points"], "times": [e["t"] for e in g["events"]]}
            for g in issue_groups
        ]
        remainder = (100 - overall) - sum(p["points"] for p in points_lost)
        if remainder > 0:
            points_lost.append({"code": None, "points": remainder, "times": []})
        changes = []
        if ctx.previous_dimensions:
            for meta, score in dims:
                prev = ctx.previous_dimensions.get(meta.key)
                if prev is not None and abs(score - prev) >= 3:
                    changes.append({"dimension": meta.key, "from": prev, "to": score})
            changes.sort(key=lambda c: -abs(c["to"] - c["from"]))

        texts = {lang: self._texts(ctx, raw, lang, overall, confidence, completed, duration_s, dims,
                                   best, worst, issue_groups, issues, errors, events, clip_events,
                                   focus, points_lost, changes)
                 for lang in LANGS}
        en, zh = texts["en"], texts["zh"]

        report = {
            "evidencePreviewUrl": None,
            "evidenceVideoUrl": ctx.evidence_video_url,
            "productName": "SutureAI",
            "reportTitle": en["reportTitle"],
            "task": ctx.task_name,
            "student": ctx.student_name,
            "recordedAt": ctx.recorded_at.isoformat() + "Z",
            "dateTime": ctx.recorded_at.strftime("%b %d, %Y · %H:%M UTC"),
            "overallScore": overall,
            "reliability": en["reliability"],
            "completed": completed,
            "duration": en["duration"],
            "durationSeconds": duration_s,
            "delta": "—" if ctx.previous_score is None else f"{overall - ctx.previous_score:+d}",
            "summary": en["summary"],
            "focus": {**focus, **en["focus"]},
            "pointsLost": [{**p, **t} for p, t in zip(points_lost, en["pointsLost"])],
            "keyMetrics": _metric_checks(raw["dimensions"], "en"),
            "changes": [{**c, **t} for c, t in zip(changes, en["changes"])],
            "dimensions": [
                {"name": meta.name, "score": score, "explanation": expl, "metrics": meta.metrics}
                for (meta, score), expl in zip(dims, en["dimensionExplanations"])
            ],
            "timeline": [
                {
                    "id": event_ids[id(e)],
                    "time": format_clock(e["t"]),
                    "timeSeconds": e["t"],
                    "title": t["title"],
                    "type": e["severity"],
                    "detail": t["detail"],
                    "clip": bool(e.get("clip")),
                    "code": e["code"],
                    **({"impact": round(_event_impact(e))} if e["severity"] != "normal" else {}),
                }
                for e, t in zip(events, en["timeline"])
            ],
            "clips": [
                {
                    "id": f"c{i}",
                    "time": format_clock(e["t"]),
                    "timeSeconds": e["t"],
                    "type": _SEVERITY_TO_CLIP_TYPE.get(e["severity"], "Step"),
                    "label": t["label"],
                    "description": t["description"],
                }
                for i, (e, t) in enumerate(zip(clip_events, en["clips"]), start=1)
            ],
            "strengths": en["strengths"],
            "weaknesses": en["weaknesses"],
            "suggestions": [s["text"] for s in en["suggestionDetails"]],
            "suggestionDetails": en["suggestionDetails"],
            "assessmentHighlights": {**en["assessmentHighlights"], "evidenceClipCount": len(clip_events)},
            "aiFeedback": en["aiFeedback"],
            "uncertainty": en["uncertainty"],
            # Review, feedback and notes live in their own tables and are merged in
            # per viewer by services.reviews.report_view().
            "i18n": {
                "zh": {
                    "reportTitle": zh["reportTitle"],
                    "task": TASK_NAMES_ZH.get(ctx.task_name, ctx.task_name),
                    "reliability": zh["reliability"],
                    "duration": zh["duration"],
                    "summary": zh["summary"],
                    "focus": zh["focus"],
                    "pointsLost": zh["pointsLost"],
                    "keyMetrics": [{"label": m["label"]} for m in _metric_checks(raw["dimensions"], "zh")],
                    "changes": zh["changes"],
                    "dimensions": [
                        {"name": meta.text("name", "zh"), "explanation": expl}
                        for (meta, _score), expl in zip(dims, zh["dimensionExplanations"])
                    ],
                    "timeline": zh["timeline"],
                    "clips": zh["clips"],
                    "strengths": zh["strengths"],
                    "weaknesses": zh["weaknesses"],
                    "suggestions": [s["text"] for s in zh["suggestionDetails"]],
                    "suggestionDetails": zh["suggestionDetails"],
                    "assessmentHighlights": zh["assessmentHighlights"],
                    "aiFeedback": zh["aiFeedback"],
                    "uncertainty": zh["uncertainty"],
                }
            },
        }
        return report

    # ---- text, per language -------------------------------------------------------

    def _texts(self, ctx, raw, lang, overall, confidence, completed, duration_s, dims, best,
               worst, issue_groups, issues, errors, events, clip_events, focus, points_lost,
               changes) -> dict[str, Any]:
        zh = lang == "zh"
        narrative = raw.get("narrative") or {}
        hand = (narrative.get("zh") or {}) if zh else narrative

        def name(meta):
            return meta.text("name", lang)

        # Focus: the one thing to fix first.
        if focus.get("code"):
            top = issue_groups[0]
            fx = _issue_text(top["code"], top["events"][0], lang)
        else:
            fx = {
                "title": worst[0].text("weakness", lang),
                "why": band_text(worst[0], worst[1], lang),
                "drill": worst[0].text("suggestion", lang),
            }

        # Where the points went.
        lost_labels = []
        for p in points_lost:
            if p["code"]:
                g = next(g for g in issue_groups if g["code"] == p["code"])
                lost_labels.append({"label": _issue_text(p["code"], g["events"][0], lang)["title"]})
            else:
                lost_labels.append({"label": "其他技术细节" if zh else "Other technique gaps"})

        # Suggestions: drills for the costliest issues first, then the weakest dimension.
        details: list[dict[str, Any]] = []
        for g in issue_groups[:2]:
            drill = _issue_text(g["code"], g["events"][0], lang)["drill"]
            if drill:
                details.append({"text": drill, "times": [e["t"] for e in g["events"]]})
        if not completed and not any(g["code"] == "recording_interrupted" for g in issue_groups[:2]):
            details.append({
                "text": "下次把整个任务一次完整录完，方便逐步评估。" if zh
                else "Record the full task end-to-end so every step can be reviewed.",
                "times": [],
            })
        for meta, _score in reversed(dims):
            if len(details) >= MAX_SUGGESTIONS:
                break
            text = meta.text("suggestion", lang)
            if all(d["text"] != text for d in details):
                details.append({"text": text, "times": []})
        details = details[:MAX_SUGGESTIONS]

        strengths = [meta.text("strength", lang) for meta, score in sorted(dims, key=lambda p: -p[1])[:2] if score >= 70]
        strengths = strengths or [best[0].text("strength", lang)]
        weaknesses = [_issue_text(g["code"], g["events"][0], lang)["title"] for g in issue_groups[:2]]
        if worst[1] < 80:
            weaknesses.append(worst[0].text("weakness", lang))
        weaknesses = weaknesses[:3] or [
            f"{name(worst[0])}是相对最弱的维度。" if zh else f"{worst[0].name} is the relatively weakest dimension."
        ]

        impact = focus.get("impact")
        if zh:
            summary = f"最需要改进：{fx['title']}" + (f"（约 {impact} 分）" if impact else "") + \
                      f"。最强的维度是{name(best[0])}（{best[1]}）。"
        else:
            summary = f"Fix first: {fx['title'].rstrip('.')}" + (f" (about {impact} points)" if impact else "") + \
                      f". Your strongest area is {best[0].name.lower()} ({best[1]})."

        if ctx.previous_score is None:
            delta_sentence = "这是第一次可以对比的训练。" if zh else "This is your first scored session for comparison."
        else:
            diff = overall - ctx.previous_score
            if zh:
                delta_sentence = "与上次持平。" if diff == 0 else f"比上次{'高' if diff > 0 else '低'} {abs(diff)} 分。"
            else:
                delta_sentence = (
                    "That matches your previous session." if diff == 0 else
                    f"That is {abs(diff)} point{'s' if abs(diff) != 1 else ''} "
                    f"{'above' if diff > 0 else 'below'} your previous session."
                )
        if zh:
            ai_feedback = [
                f"总分 {overall}/100。{delta_sentence}",
                f"录像中标记了 {len(issues)} 个问题" + (f"，其中 {len(errors)} 个严重问题。" if errors else "。"),
                f"下一步重点：{fx['drill'] or fx['title']}",
            ]
        else:
            ai_feedback = [
                f"Overall score {overall}/100. {delta_sentence}",
                f"{len(issues)} issue(s) flagged in the recording"
                + (f", including {len(errors)} error(s)." if errors else "."),
                f"Focus next: {fx['drill'] or fx['title']}",
            ]

        uncertainty = list((raw.get("notesZh") if zh else None) or raw.get("notes", []))
        if confidence < 0.6:
            uncertainty.append(
                "评分置信度较低（机位、光线或遮挡），在教师确认前请把分数当作参考。" if zh else
                "Scoring confidence is low (camera angle, lighting or occlusion); "
                "treat the scores as indicative until an instructor confirms them."
            )
        elif not uncertainty:
            uncertainty.append("这段录像没有发现明显影响判断的因素。" if zh
                               else "No major uncertainty sources detected in this recording.")

        def event_title(e):
            if not zh:
                return e["label"]
            return e.get("labelZh") or label_zh(e["code"]) or e["label"]

        def event_detail(e):
            return (e.get("detailZh") if zh else None) or e.get("detail", "")

        texts = {
            "reportTitle": "训练报告" if zh else "Training Report",
            "reliability": reliability_label(confidence, lang),
            "duration": format_duration(duration_s, lang),
            "summary": summary,
            "focus": {"title": fx["title"], "why": fx["why"], "drill": fx["drill"]},
            "pointsLost": lost_labels,
            "changes": [{"name": name(DIMENSIONS_BY_KEY[c["dimension"]])} for c in changes],
            "dimensionExplanations": [band_text(meta, score, lang) for meta, score in dims],
            "timeline": [{"title": event_title(e), "detail": event_detail(e)} for e in events],
            "clips": [{"label": event_title(e), "description": event_detail(e)} for e in clip_events],
            "strengths": strengths,
            "weaknesses": weaknesses,
            "suggestionDetails": details,
            "assessmentHighlights": {
                "strongestDimension": name(best[0]),
                "mainIssue": fx["title"],
                "practiceFocus": name(worst[0]),
            },
            "aiFeedback": ai_feedback,
            "uncertainty": uncertainty,
        }

        # Hand-written narrative (annotated demo recordings) replaces generated wording.
        expl = hand.get("dimensionExplanations") or {}
        texts["dimensionExplanations"] = [
            expl.get(meta.name, t) for (meta, _s), t in zip(dims, texts["dimensionExplanations"])
        ]
        for key, value in hand.items():
            if key not in NARRATIVE_KEYS:
                continue
            if key == "assessmentHighlights":
                texts[key] = {**texts[key], **value}
            elif key == "suggestions":
                # Items are plain strings or {"text", "times"} to link them to the video.
                texts["suggestionDetails"] = [
                    v if isinstance(v, dict) else {"text": v, "times": []} for v in value
                ]
            else:
                texts[key] = value
        return texts
