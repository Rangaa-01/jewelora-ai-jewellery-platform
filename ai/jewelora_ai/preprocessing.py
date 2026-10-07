"""Image loading, orientation, validation and resizing."""

from __future__ import annotations

import io
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError


class InvalidImageError(ValueError):
    pass


@dataclass(frozen=True)
class PreprocessedImage:
    rgb: np.ndarray  # uint8 (H, W, 3)
    original_width: int
    original_height: int
    scale: float  # preprocessed / original


def load_rgb(
    data: bytes, *, max_dimension: int = 1600, min_dimension: int = 240
) -> PreprocessedImage:
    """Decode bytes to an oriented RGB array no larger than ``max_dimension`` on its long side."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.load()
            oriented = ImageOps.exif_transpose(img) or img
            rgb = oriented.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImageError("The file could not be decoded as an image.") from exc
    ow, oh = rgb.size
    if min(ow, oh) < min_dimension:
        raise InvalidImageError(
            "The photo is too small. Please use a photo at least 240 pixels on its short side."
        )
    scale = 1.0
    if max(ow, oh) > max_dimension:
        scale = max_dimension / max(ow, oh)
        rgb = rgb.resize(
            (max(1, round(ow * scale)), max(1, round(oh * scale))), Image.Resampling.LANCZOS
        )
    return PreprocessedImage(
        rgb=np.asarray(rgb, dtype=np.uint8), original_width=ow, original_height=oh, scale=scale
    )


def load_rgba_asset(data: bytes) -> np.ndarray:
    try:
        with Image.open(io.BytesIO(data)) as img:
            return np.asarray(img.convert("RGBA"), dtype=np.uint8)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImageError("The jewellery asset could not be decoded.") from exc


def encode_image(rgb: np.ndarray, *, fmt: str = "WEBP", quality: int = 90) -> bytes:
    out = io.BytesIO()
    Image.fromarray(rgb).save(out, format=fmt, quality=quality, method=4)
    return out.getvalue()
