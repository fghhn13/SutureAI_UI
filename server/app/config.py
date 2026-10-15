"""Runtime settings, read from environment variables (prefix ``SUTURE_``).

Defaults are tuned for local development; see ``server/.env.example``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _env(name: str, default: str) -> str:
    return os.environ.get(f"SUTURE_{name}", default)


def _env_bool(name: str, default: bool) -> bool:
    return _env(name, "1" if default else "0").strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(_env("DATA_DIR", str(REPO_ROOT / "data"))))
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", ""))

    # Auth
    session_cookie_name: str = "suture_session"
    session_ttl_hours: int = field(default_factory=lambda: int(_env("SESSION_TTL_HOURS", "168")))
    cookie_secure: bool = field(default_factory=lambda: _env_bool("COOKIE_SECURE", False))

    # Uploads
    max_upload_mb: int = field(default_factory=lambda: int(_env("MAX_UPLOAD_MB", "1024")))

    # Pipeline providers: "demo" (registered demo videos, else fallback) | "mock" |
    # (future) "http"  /  "template" | (future) "llm"
    scoring_provider: str = field(default_factory=lambda: _env("SCORING_PROVIDER", "demo"))
    report_provider: str = field(default_factory=lambda: _env("REPORT_PROVIDER", "template"))
    mock_scoring_delay_s: float = field(
        default_factory=lambda: float(_env("MOCK_SCORING_DELAY_S", "4"))
    )
    mock_report_delay_s: float = field(
        default_factory=lambda: float(_env("MOCK_REPORT_DELAY_S", "4"))
    )

    # Demo recordings (providers/demo.py)
    demo_dir: Path = field(
        default_factory=lambda: Path(_env("DEMO_DIR", str(REPO_ROOT / "server" / "demo")))
    )
    demo_analysis_s: float = field(default_factory=lambda: float(_env("DEMO_ANALYSIS_S", "24")))
    # What to do with uploads that are not registered demo videos: "mock" | "reject"
    demo_fallback: str = field(default_factory=lambda: _env("DEMO_FALLBACK", "mock"))

    # Background worker
    worker_enabled: bool = field(default_factory=lambda: _env_bool("WORKER_ENABLED", True))
    worker_poll_interval_s: float = field(
        default_factory=lambda: float(_env("WORKER_POLL_INTERVAL_S", "1"))
    )

    @property
    def video_dir(self) -> Path:
        return self.data_dir / "videos"

    @property
    def resolved_database_url(self) -> str:
        return self.database_url or f"sqlite:///{(self.data_dir / 'app.db').as_posix()}"


def get_settings() -> Settings:
    return Settings()
