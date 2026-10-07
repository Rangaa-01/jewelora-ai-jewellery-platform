"""Serves objects from LocalStorage. Not used when STORAGE_BACKEND=s3 (URLs point at the bucket)."""

from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path

from fastapi import APIRouter, Query, Response
from fastapi.responses import FileResponse

from app.core.errors import AuthorizationError, NotFoundError
from app.storage import get_storage
from app.storage.base import is_public_key, validate_key
from app.storage.local import LocalStorage

router = APIRouter(prefix="/media", tags=["media"])

_MEDIA_TYPES = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".glb": "model/gltf-binary",
}
_IMMUTABLE = "public, max-age=31536000, immutable"
_PRIVATE = "private, no-store"


@router.get("/{key:path}", include_in_schema=False)
async def serve_media(
    key: str, exp: int | None = Query(default=None), sig: str | None = Query(default=None)
) -> Response:
    storage = get_storage()
    if not isinstance(storage, LocalStorage):
        raise NotFoundError()
    try:
        validate_key(key)
    except ValueError as exc:
        raise NotFoundError() from exc
    if not is_public_key(key) and (exp is None or sig is None or not storage.verify(key, exp, sig)):
        raise AuthorizationError("This link has expired.")
    path: Path = storage.resolve_path(key)
    if not await asyncio.to_thread(path.is_file):
        raise NotFoundError()
    media_type = _MEDIA_TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0]
    media_type = media_type or "application/octet-stream"
    headers = {
        "Cache-Control": _IMMUTABLE if is_public_key(key) else _PRIVATE,
        "X-Content-Type-Options": "nosniff",
    }
    return FileResponse(path, media_type=media_type, headers=headers)
