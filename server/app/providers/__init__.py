"""Provider registry. Add real implementations here and select them via env:

- ``SUTURE_SCORING_PROVIDER``: ``mock`` (default); e.g. ``http`` for the scoring API
- ``SUTURE_REPORT_PROVIDER``: ``template`` (default); e.g. ``llm``
"""

from __future__ import annotations

from ..config import Settings
from .base import ReportProvider, ScoringProvider
from .mock_scoring import MockScoringProvider
from .template_report import TemplateReportProvider


def build_scoring_provider(settings: Settings) -> ScoringProvider:
    if settings.scoring_provider == "mock":
        return MockScoringProvider(delay_s=settings.mock_scoring_delay_s)
    raise ValueError(f"Unknown scoring provider: {settings.scoring_provider!r}")


def build_report_provider(settings: Settings) -> ReportProvider:
    if settings.report_provider == "template":
        return TemplateReportProvider(delay_s=settings.mock_report_delay_s)
    raise ValueError(f"Unknown report provider: {settings.report_provider!r}")
