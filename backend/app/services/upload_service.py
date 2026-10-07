"""Upload validation and normalisation.

Every file that reaches storage passes through here. Images are fully decoded with
Pillow (bomb-protected), re-encoded (which strips EXIF/metadata and neutralises
polyglot payloads) and size-capped. 3D models are checked for the GLB magic header and
sane chunk structure.
"""

from __future__ import annotations

import io
import struct
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import PayloadTooLargeError, UploadError
from app.core.settings import Settings

Image.MAX_IMAGE_PIXELS = (
    64_000_000  # hard ceiling; settings.upload_max_pixels is checked explicitly
)

_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # followed by size + WEBP
}


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    content_type: str
    extension: str
    width: int
    height: int
    has_alpha: bool


def sniff_image_type(data: bytes) -> str | None:
    for magic, mime in _MAGIC.items():
        if data.startswith(magic):
            if mime == "image/webp" and data[8:12] != b"WEBP":
                return None
            return mime
    return None


def process_image(
    data: bytes,
    settings: Settings,
    *,
    max_bytes: int | None = None,
    max_dimension: int | None = None,
    keep_alpha: bool = False,
    quality: int = 88,
) -> ProcessedImage:
    """Validate, orient, resize and re-encode an uploaded image."""
    limit = max_bytes or settings.upload_max_bytes
    if len(data) > limit:
        raise PayloadTooLargeError(f"Images must be smaller than {limit // (1024 * 1024)} MB.")
    if len(data) < 64:
        raise UploadError("That file does not look like an image.")
    mime = sniff_image_type(data)
    if mime is None or mime not in settings.upload_allowed_image_types:
        raise UploadError("Please upload a JPEG, PNG or WebP image.")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            probe.verify()
        with Image.open(io.BytesIO(data)) as source:
            if source.width * source.height > settings.upload_max_pixels:
                raise UploadError("That image has too many pixels. Please use a smaller photo.")
            oriented: Image.Image = ImageOps.exif_transpose(source) or source
            has_alpha = keep_alpha and (
                oriented.mode in ("RGBA", "LA") or "transparency" in oriented.info
            )
            img: Image.Image = oriented.convert("RGBA" if has_alpha else "RGB")
            if max_dimension and max(img.size) > max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            if has_alpha:
                img.save(out, format="WEBP", quality=quality, method=5, lossless=False, exact=True)
                content_type, ext = "image/webp", "webp"
            else:
                img.save(out, format="WEBP", quality=quality, method=5)
                content_type, ext = "image/webp", "webp"
            return ProcessedImage(
                data=out.getvalue(),
                content_type=content_type,
                extension=ext,
                width=img.width,
                height=img.height,
                has_alpha=has_alpha,
            )
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise UploadError() from exc


def validate_glb(data: bytes, settings: Settings) -> int:
    """Return the file size after verifying the GLB container. Raises UploadError."""
    if len(data) > settings.model_asset_max_bytes:
        raise PayloadTooLargeError(
            f"3D models must be smaller than {settings.model_asset_max_bytes // (1024 * 1024)} MB."
        )
    if len(data) < 20 or data[:4] != b"glTF":
        raise UploadError("Please upload a binary glTF (.glb) model.")
    version, length = struct.unpack_from("<II", data, 4)
    if version != 2 or length != len(data):
        raise UploadError("That .glb file appears to be corrupted.")
    chunk_length, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON" or 20 + chunk_length > len(data):
        raise UploadError("That .glb file appears to be corrupted.")
    return len(data)
