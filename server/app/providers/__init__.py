"""Provider registry. Add real implementations here and select them via env:

- ``SUTURE_SCORING_PROVIDER``: ``demo`` (default: registered demo videos get their annotation,
  everything else falls back to ``mock``), ``mock``; e.g. ``http`` for the scoring API
- ``SUTURE_REPORT_PROVIDER``: ``template`` (default); e.g. ``llm``
"""

from __future__ import annotations

from ..config import Settings
from .base import ReportProvider, ScoringProvider
from .demo import DemoScoringProvider
from .mock_scoring import MockScoringProvider
from .template_report import TemplateReportProvider


def build_scoring_provider(settings: Settings) -> ScoringProvider:
    mock = MockScoringProvider(delay_s=settings.mock_scoring_delay_s)
    if settings.scoring_provider == "mock":
        return mock
    if settings.scoring_provider == "demo":
        if settings.demo_fallback not in {"mock", "reject"}:
            raise ValueError(f"Unknown demo fallback: {settings.demo_fallback!r}")
        return DemoScoringProvider(
            settings.demo_dir,
            settings.demo_analysis_s,
            fallback=mock if settings.demo_fallback == "mock" else None,
        )
    raise ValueError(f"Unknown scoring provider: {settings.scoring_provider!r}")


def build_report_provider(settings: Settings) -> ReportProvider:
    if settings.report_provider == "template":
        return TemplateReportProvider(delay_s=settings.mock_report_delay_s)
    raise ValueError(f"Unknown report provider: {settings.report_provider!r}")
