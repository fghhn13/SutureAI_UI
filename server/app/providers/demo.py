"""Scripted scoring for registered demo recordings.

Until the real scoring API exists, demos need reports that match what is actually in the
video. A demo recording is registered in ``server/demo/registry.json`` (by SHA-256, with an
optional filename fallback) and paired with a hand-made annotation in the raw-scoring
format (``providers.base``). When an upload matches, the annotation is returned after a
paced walk through the analysis stages so the progress screen has something to show.

Unregistered uploads go to the fallback provider (mock scoring), or fail with a clear
message when no fallback is configured (``SUTURE_DEMO_FALLBACK=reject``).

Register a video:  python -m app.demo register path/to/video.mp4 --id suture-demo-1
"""

from __future__ import annotations

import copy
import json
import time
from pathlib import Path
from typing import Any

from .base import SCORING_STAGES, ScoringContext, ScoringProvider, UserFacingError, run_stages


class NotADemoRecording(UserFacingError):
    pass


def load_registry(demo_dir: Path) -> list[dict[str, Any]]:
    path = demo_dir / "registry.json"
    if not path.is_file():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("recordings", [])


def find_recording(
    demo_dir: Path, sha256: str | None, filename: str | None
) -> tuple[dict[str, Any], str] | None:
    """Return (registry entry, how it matched) for a registered demo recording."""
    recordings = load_registry(demo_dir)
    if sha256:
        for rec in recordings:
            if sha256.lower() in {h.lower() for h in rec.get("sha256", [])}:
                return rec, "sha256"
    if filename:
        name = Path(filename).name.lower()
        for rec in recordings:
            if name in {f.lower() for f in rec.get("filenames", [])}:
                return rec, "filename"
    return None


class DemoScoringProvider:
    name = "demo"

    def __init__(self, demo_dir: Path, analysis_s: float, fallback: ScoringProvider | None):
        self.demo_dir = demo_dir
        self.analysis_s = analysis_s
        self.fallback = fallback

    def score(self, ctx: ScoringContext) -> dict[str, Any]:
        match = find_recording(self.demo_dir, ctx.video_sha256, ctx.original_filename)
        if match is None:
            if self.fallback is None:
                raise NotADemoRecording(
                    "This recording is not a registered demo video. Upload the demo recording "
                    "or register this file with `python -m app.demo register`."
                )
            raw = self.fallback.score(ctx)
            raw.setdefault("source", self.fallback.name)
            return raw

        rec, matched_by = match
        run_stages(ctx.progress, SCORING_STAGES, self.analysis_s, time.sleep)
        annotation = json.loads((self.demo_dir / rec["annotation"]).read_text(encoding="utf-8"))
        raw = copy.deepcopy(annotation)
        raw["source"] = f"demo:{rec['id']} ({matched_by})"
        if ctx.duration_s and not raw.get("durationSeconds"):
            raw["durationSeconds"] = ctx.duration_s
        return raw
