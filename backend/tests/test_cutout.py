"""Automatic cut-out options: crop, rotate, single piece and hole punching."""

from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.core.settings import get_settings
from app.services.cutout_service import CutoutOptions, crop_photo, make_tryon_asset

pytestmark = pytest.mark.skipif(
    not (get_settings().ai_models_dir / "u2net.onnx").is_file(),
    reason="u2net.onnx not downloaded",
)


def _ring_on_red() -> bytes:
    """A gold ring (annulus) on red fabric with a loose stone beside it."""
    img = Image.new("RGB", (640, 480), (150, 20, 40))
    d = ImageDraw.Draw(img)
    d.ellipse((120, 60, 420, 360), fill=(212, 175, 55))
    d.ellipse((160, 100, 380, 320), fill=(150, 20, 40))
    d.ellipse((470, 300, 560, 390), fill=(240, 240, 250))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _alpha(png: bytes) -> np.ndarray:
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))[..., 3]


def test_punch_holes_releases_the_backdrop_inside_a_ring() -> None:
    settings = get_settings()
    photo = _ring_on_red()
    filled = make_tryon_asset(photo, "ring", settings, options=CutoutOptions(punch_holes=False))
    punched = make_tryon_asset(photo, "ring", settings, options=CutoutOptions(punch_holes=True))
    a_filled, a_punched = _alpha(filled.png), _alpha(punched.png)
    centre_filled = a_filled[a_filled.shape[0] // 2, a_filled.shape[1] // 2]
    centre_punched = a_punched[a_punched.shape[0] // 2, a_punched.shape[1] // 2]
    assert centre_punched == 0, "the inside of the ring must be transparent"
    assert punched.coverage < filled.coverage or centre_filled > 0
    assert set(punched.anchors) == {"band_left", "band_right", "center", "top"}


def test_single_piece_drops_the_loose_stone_and_crop_rotate_apply() -> None:
    settings = get_settings()
    photo = _ring_on_red()
    both = make_tryon_asset(photo, "ring", settings, options=CutoutOptions(single_piece=False))
    one = make_tryon_asset(photo, "ring", settings, options=CutoutOptions(single_piece=True))
    assert one.width < both.width  # the stone on the right is gone
    cropped = make_tryon_asset(
        photo, "ring", settings, options=CutoutOptions(crop=(0.0, 0.0, 0.7, 1.0))
    )
    assert cropped.width <= one.width + 2
    rotated = make_tryon_asset(
        photo, "ring", settings, options=CutoutOptions(rotate=90, single_piece=True)
    )
    assert abs(rotated.width - one.height) <= 4 and abs(rotated.height - one.width) <= 4
    half = Image.open(io.BytesIO(crop_photo(photo, (0.0, 0.0, 0.5, 1.0))))
    assert half.size == (320, 480)


def test_options_from_dict_parses_seed_entries() -> None:
    opts = CutoutOptions.from_dict({"crop": [0, 0.2, 1, 1], "rotate": "90", "single_piece": True})
    assert opts.crop == (0.0, 0.2, 1.0, 1.0) and opts.rotate == 90 and opts.single_piece is True
    assert opts.punch_holes is None and CutoutOptions.from_dict(None) == CutoutOptions()
