"""Training-session processing: uploaded -> scoring -> scored -> generating -> ready.

State lives entirely in the ``training_sessions`` table, so a restart resumes where it
left off. Stages are claimed with a conditional UPDATE, which keeps this safe if more
than one worker process ever runs.
"""

from __future__ import annotations

import logging
import threading
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import Settings
from ..db import Database
from ..models import Report, ScoringResult, SessionStatus, TrainingSession, utcnow
from ..providers.base import (
    ReportContext,
    ReportProvider,
    ScoringContext,
    ScoringProvider,
    UserFacingError,
)

log = logging.getLogger(__name__)

S = SessionStatus

# Share of the overall progress bar each step covers.
SCORING_SPAN = (0.02, 0.80)
REPORT_SPAN = (0.80, 1.00)

# stage input status -> (in-progress status, next status)
_STAGES = {
    S.SCORED: (S.GENERATING, S.READY),
    S.UPLOADED: (S.SCORING, S.SCORED),
}


def video_url(session_id: str) -> str:
    return f"/api/sessions/{session_id}/video"


class Pipeline:
    def __init__(
        self,
        database: Database,
        settings: Settings,
        scoring: ScoringProvider,
        reporter: ReportProvider,
    ):
        self.database = database
        self.settings = settings
        self.scoring = scoring
        self.reporter = reporter

    # -- lifecycle -----------------------------------------------------------------

    def recover(self) -> None:
        """Requeue stages that were in flight when the process stopped."""
        with self.database.session() as db:
            for in_flight, back_to in ((S.SCORING, S.UPLOADED), (S.GENERATING, S.SCORED)):
                db.execute(
                    update(TrainingSession)
                    .where(TrainingSession.status == in_flight.value)
                    .values(status=back_to.value)
                )
            db.commit()

    @staticmethod
    def retry(db: Session, ts: TrainingSession) -> None:
        """Re-queue a failed session from the last stage that succeeded."""
        if ts.status != S.FAILED.value:
            raise ValueError("Only failed sessions can be retried.")
        if ts.scoring is not None:
            ts.status = S.SCORED.value
            ts.progress = REPORT_SPAN[0]
        elif ts.video is not None:
            ts.status = S.UPLOADED.value
            ts.progress = 0.0
        else:
            ts.status = S.CREATED.value
            ts.progress = None
        ts.stage = None
        ts.error = None
        db.commit()

    # -- processing ----------------------------------------------------------------

    def process_one(self) -> bool:
        """Run one stage of one session. Returns False when there is nothing to do."""
        claimed = self._claim()
        if claimed is None:
            return False
        session_id, stage = claimed
        try:
            if stage == S.UPLOADED:
                self._run_scoring(session_id)
            else:
                self._run_report(session_id)
        except UserFacingError as exc:
            log.info("Pipeline stage %s rejected session %s: %s", stage.value, session_id, exc)
            self._fail(session_id, str(exc))
        except Exception as exc:  # provider errors must not kill the worker
            log.exception("Pipeline stage %s failed for session %s", stage.value, session_id)
            self._fail(session_id, f"{type(exc).__name__}: {exc}")
        return True

    def run_until_idle(self, max_steps: int = 1000) -> None:
        for _ in range(max_steps):
            if not self.process_one():
                return

    def _claim(self) -> tuple[str, SessionStatus] | None:
        with self.database.session() as db:
            for ready_status, (running, _next) in _STAGES.items():
                candidate = db.scalar(
                    select(TrainingSession.id)
                    .where(TrainingSession.status == ready_status.value)
                    .order_by(TrainingSession.updated_at)
                    .limit(1)
                )
                if candidate is None:
                    continue
                result = db.execute(
                    update(TrainingSession)
                    .where(
                        TrainingSession.id == candidate,
                        TrainingSession.status == ready_status.value,
                    )
                    .values(
                        status=running.value,
                        attempts=TrainingSession.attempts + 1,
                        updated_at=utcnow(),
                    )
                )
                db.commit()
                if result.rowcount == 1:
                    return candidate, ready_status
        return None

    def _run_scoring(self, session_id: str) -> None:
        with self.database.session() as db:
            ts = db.get(TrainingSession, session_id)
            video = ts.video
            ctx = ScoringContext(
                session_id=ts.id,
                task_id=ts.task_id,
                task_name=ts.task.name,
                video_path=(self.settings.video_dir / video.path) if video else None,
                duration_s=video.duration_s if video else None,
                video_sha256=video.sha256 if video else None,
                original_filename=video.original_filename if video else None,
                progress=self._progress_writer(session_id, *SCORING_SPAN),
            )
        raw = self.scoring.score(ctx)  # may be slow; no DB session held
        with self.database.session() as db:
            ts = db.get(TrainingSession, session_id)
            if ts.scoring is not None:
                db.delete(ts.scoring)
                db.flush()
            db.add(
                ScoringResult(
                    session_id=session_id,
                    provider=self.scoring.name,
                    overall_score=int(raw["overallScore"]),
                    raw=raw,
                )
            )
            ts.status = S.SCORED.value
            ts.progress = SCORING_SPAN[1]
            db.commit()

    def _run_report(self, session_id: str) -> None:
        with self.database.session() as db:
            ts = db.get(TrainingSession, session_id)
            ctx = ReportContext(
                session_id=ts.id,
                task_name=ts.task.name,
                student_name=ts.user.display_name,
                recorded_at=ts.uploaded_at or ts.created_at,
                scoring=ts.scoring.raw,
                previous_score=previous_score(db, ts),
                evidence_video_url=video_url(ts.id) if ts.video else None,
                progress=self._progress_writer(session_id, *REPORT_SPAN),
            )
        content = self.reporter.generate(ctx)
        save_report(self.database, session_id, self.reporter.name, content)

    def _progress_writer(self, session_id: str, lo: float, hi: float):
        """Callback for providers: maps their 0..1 onto [lo, hi] of the session's bar."""
        last = {"value": -1.0, "stage": None}

        def write(fraction: float, stage: str) -> None:
            value = lo + (hi - lo) * min(1.0, max(0.0, fraction))
            if stage == last["stage"] and value - last["value"] < 0.005:
                return  # skip no-op writes
            last.update(value=value, stage=stage)
            with self.database.session() as db:
                db.execute(
                    update(TrainingSession)
                    .where(TrainingSession.id == session_id)
                    .values(progress=round(value, 4), stage=stage)
                )
                db.commit()

        return write

    def _fail(self, session_id: str, message: str) -> None:
        with self.database.session() as db:
            ts = db.get(TrainingSession, session_id)
            if ts is not None:
                ts.status = S.FAILED.value
                ts.error = message[:1000]
                db.commit()


def previous_score(db: Session, ts: TrainingSession) -> int | None:
    return db.scalar(
        select(Report.overall_score)
        .join(TrainingSession, Report.session_id == TrainingSession.id)
        .where(
            TrainingSession.user_id == ts.user_id,
            TrainingSession.id != ts.id,
            TrainingSession.created_at < ts.created_at,
        )
        .order_by(TrainingSession.created_at.desc())
        .limit(1)
    )


def save_report(database: Database, session_id: str, generator: str, content: dict[str, Any]) -> None:
    with database.session() as db:
        ts = db.get(TrainingSession, session_id)
        if ts.report is not None:
            db.delete(ts.report)
            db.flush()
        db.add(
            Report(
                session_id=session_id,
                generator=generator,
                overall_score=int(content["overallScore"]),
                content=content,
            )
        )
        ts.status = S.READY.value
        ts.progress = 1.0
        ts.stage = None
        ts.finished_at = utcnow()
        db.commit()


class Worker:
    """Background thread that drains the pipeline."""

    def __init__(self, pipeline: Pipeline, poll_interval_s: float):
        self.pipeline = pipeline
        self.poll_interval_s = poll_interval_s
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="pipeline-worker", daemon=True)

    def start(self) -> None:
        self.pipeline.recover()
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        self._thread.join(timeout)

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                busy = self.pipeline.process_one()
            except Exception:
                log.exception("Pipeline worker iteration failed")
                busy = False
            if not busy:
                self._stop.wait(self.poll_interval_s)
