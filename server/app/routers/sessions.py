from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import Settings
from ..deps import get_current_user, get_db, get_owned_session, get_settings
from ..models import SessionStatus, Task, TrainingSession, User, Video, utcnow
from ..schemas import CreateSessionIn, SessionOut, TaskOut, VideoOut
from ..services import storage
from ..services.pipeline import Pipeline, video_url

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

S = SessionStatus


def session_out(ts: TrainingSession) -> SessionOut:
    video = ts.video
    return SessionOut(
        id=ts.id,
        status=ts.status,
        error=ts.error,
        task=TaskOut.model_validate(ts.task),
        video=VideoOut(
            original_filename=video.original_filename,
            mime_type=video.mime_type,
            size_bytes=video.size_bytes,
            duration_s=video.duration_s,
            url=video_url(ts.id),
        )
        if video
        else None,
        overall_score=ts.report.overall_score if ts.report else None,
        created_at=ts.created_at,
        uploaded_at=ts.uploaded_at,
        finished_at=ts.finished_at,
    )


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    body: CreateSessionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionOut:
    task = db.get(Task, body.task_id)
    if task is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown task.")
    ts = TrainingSession(user_id=user.id, task_id=task.id)
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return session_out(ts)


@router.get("", response_model=list[SessionOut])
def list_sessions(
    status_filter: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SessionOut]:
    q = (
        select(TrainingSession)
        .where(TrainingSession.user_id == user.id)
        .options(
            selectinload(TrainingSession.task),
            selectinload(TrainingSession.video),
            selectinload(TrainingSession.report),
        )
        .order_by(TrainingSession.created_at.desc())
        .limit(min(max(limit, 1), 200))
    )
    if status_filter:
        q = q.where(TrainingSession.status == status_filter)
    return [session_out(ts) for ts in db.scalars(q)]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(ts: TrainingSession = Depends(get_owned_session)) -> SessionOut:
    return session_out(ts)


@router.post("/{session_id}/video", response_model=SessionOut)
def upload_video(
    request: Request,
    file: UploadFile = File(...),
    duration_seconds: float | None = Form(None, alias="durationSeconds"),
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> SessionOut:
    if ts.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the student can upload to a session.")
    if ts.status != S.CREATED.value:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Session is already {ts.status}.")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > max_bytes + 1024 * 1024:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"Max upload is {settings.max_upload_mb} MB.")

    mime = storage.resolve_video_type(file.content_type, file.filename)
    if mime is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Upload an MP4, WebM, MOV or MKV video."
        )

    name = f"{ts.id}{storage.ALLOWED_VIDEO_TYPES[mime]}"
    try:
        stored = storage.save_stream(file.file, settings.video_dir, name, max_bytes)
    except storage.UploadTooLarge:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, f"Max upload is {settings.max_upload_mb} MB."
        ) from None
    if stored.size_bytes == 0:
        storage.delete_quietly(settings.video_dir / name)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The uploaded file is empty.")

    duration = duration_seconds if duration_seconds and 0 < duration_seconds < 6 * 3600 else None
    db.add(
        Video(
            session_id=ts.id,
            path=stored.relative_path,
            original_filename=(file.filename or "")[:255] or None,
            mime_type=mime,
            size_bytes=stored.size_bytes,
            duration_s=duration,
            sha256=stored.sha256,
        )
    )
    ts.status = S.UPLOADED.value
    ts.uploaded_at = utcnow()
    db.commit()
    db.refresh(ts)
    return session_out(ts)


@router.get("/{session_id}/video")
def get_video(
    ts: TrainingSession = Depends(get_owned_session),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    if ts.video is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No video uploaded for this session.")
    path = settings.video_dir / ts.video.path
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Video file is missing on the server.")
    # FileResponse handles Range requests, so the report player can seek.
    return FileResponse(path, media_type=ts.video.mime_type)


@router.post("/{session_id}/retry", response_model=SessionOut)
def retry_session(
    ts: TrainingSession = Depends(get_owned_session),
    db: Session = Depends(get_db),
) -> SessionOut:
    try:
        Pipeline.retry(db, ts)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None
    db.refresh(ts)
    return session_out(ts)
