"""FastAPI entry point: ``uvicorn app.main:app --reload`` (run from ``server/``)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import Settings, get_settings
from .db import Database
from .providers import build_report_provider, build_scoring_provider
from .routers import auth, dashboard, instructor, reports, sessions, tasks
from .seed import has_cohorts, is_empty, seed
from .services.pipeline import Pipeline, Worker

log = logging.getLogger("suture")


def create_app(settings: Settings | None = None, *, auto_seed: bool = True) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.video_dir.mkdir(parents=True, exist_ok=True)
        database: Database = app.state.db
        database.create_all()
        if auto_seed and is_empty(database):
            log.warning("Empty database — seeding demo data.")
            seed(database, settings)
        elif not has_cohorts(database):
            log.warning(
                "Database predates cohorts/instructors; run `python -m app.seed --reset` "
                "(from server/) to load the instructor demo data."
            )

        worker = None
        if settings.worker_enabled:
            worker = Worker(app.state.pipeline, settings.worker_poll_interval_s)
            worker.start()
        try:
            yield
        finally:
            if worker:
                worker.stop()
            database.engine.dispose()

    app = FastAPI(title="SutureAI API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.db = Database(settings.resolved_database_url)
    app.state.pipeline = Pipeline(
        app.state.db,
        settings,
        build_scoring_provider(settings),
        build_report_provider(settings),
    )

    for r in (
        auth.router,
        tasks.router,
        sessions.router,
        reports.router,
        dashboard.router,
        instructor.router,
    ):
        app.include_router(r)

    @app.get("/api/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
