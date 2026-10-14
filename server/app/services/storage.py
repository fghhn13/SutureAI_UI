"""Local disk storage for uploaded training videos."""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-matroska": ".mkv",
}
_EXT_TO_TYPE = {ext: mime for mime, ext in ALLOWED_VIDEO_TYPES.items()}

_CHUNK = 1024 * 1024


class UploadTooLarge(Exception):
    pass


@dataclass(frozen=True)
class StoredFile:
    relative_path: str
    size_bytes: int
    sha256: str


def resolve_video_type(content_type: str | None, filename: str | None) -> str | None:
    """Browsers sometimes send an empty or generic type (e.g. .mkv); fall back to the extension."""
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct in ALLOWED_VIDEO_TYPES:
        return ct
    ext = Path(filename or "").suffix.lower()
    return _EXT_TO_TYPE.get(ext)


def save_stream(src: BinaryIO, video_dir: Path, name: str, max_bytes: int) -> StoredFile:
    """Copy ``src`` to ``video_dir/name`` atomically, hashing as we go."""
    video_dir.mkdir(parents=True, exist_ok=True)
    final = video_dir / name
    tmp = video_dir / f".{name}.part"
    digest = hashlib.sha256()
    size = 0
    try:
        with open(tmp, "wb") as out:
            while chunk := src.read(_CHUNK):
                size += len(chunk)
                if size > max_bytes:
                    raise UploadTooLarge
                digest.update(chunk)
                out.write(chunk)
        os.replace(tmp, final)
    finally:
        if tmp.exists():
            tmp.unlink()
    return StoredFile(relative_path=name, size_bytes=size, sha256=digest.hexdigest())


def delete_quietly(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass
