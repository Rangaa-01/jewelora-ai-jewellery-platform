"""Photographic integration, refinement guards and photo checks."""

from __future__ import annotations

import numpy as np

from jewelora_ai.analysis.photo_quality import analyse_photo
from jewelora_ai.datatypes import JewelleryType, SegmentationMasks
from jewelora_ai.refinement import NoRefinement, apply_guards, refinement_band
from jewelora_ai.rendering import realism
from tests.conftest import load_fixture_image, load_fixture_landmarks


def _skin_photo(
    rgb: tuple[int, int, int], noise: float = 0.0
) -> tuple[np.ndarray, SegmentationMasks]:
    img = np.full((200, 200, 3), rgb, dtype=np.float32)
    # left side brighter: light from image-left
    img *= np.linspace(1.15, 0.85, 200, dtype=np.float32)[None, :, None]
    if noise:
        img += np.random.default_rng(1).normal(0, noise * 255, img.shape)
    skin = np.zeros((200, 200), dtype=np.float32)
    skin[30:170, 30:170] = 1.0
    return np.clip(img, 0, 255).astype(np.uint8), SegmentationMasks(face_skin=skin)


def test_scene_light_reads_colour_cast_direction_and_noise() -> None:
    warm, masks = _skin_photo((220, 150, 90))
    cool, _ = _skin_photo((170, 150, 150))
    lw, lc = realism.analyse_scene(warm, masks), realism.analyse_scene(cool, masks)
    assert lw.gain[0] / lw.gain[2] > lc.gain[0] / lc.gain[2], "warm photo → warmer jewellery"
    luma = lambda g: 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2]  # noqa: E731
    assert abs(luma(lw.gain) - 1.0) < 1e-3, "colour cast must not change brightness"
    assert lw.direction[0] < -0.9 and lw.strength > 0.2, "light comes from image-left"
    noisy, _ = _skin_photo((200, 160, 120), noise=0.03)
    assert realism.estimate_noise_sigma(noisy) > 3 * realism.estimate_noise_sigma(warm)


def test_defringe_removes_backdrop_halo() -> None:
    rgba = np.zeros((40, 40, 4), dtype=np.uint8)
    rgba[10:30, 10:30] = (212, 175, 55, 255)  # gold
    rgba[9, 10:30] = (0, 0, 0, 120)  # black studio fringe
    out = realism.defringe(rgba)
    assert out[9, 20, :3].tolist() == [212, 175, 55] and out[9, 20, 3] == 120


def test_strand_ends_fade_but_drops_stay() -> None:
    rgba = np.full((100, 200, 4), 255, dtype=np.uint8)
    out = realism.wrap_strand_ends(rgba, left_x=10, right_x=190, top_y=5)
    assert out[5, 10, 3] < 60 and out[5, 100, 3] == 255 and out[95, 10, 3] == 255


def test_guards_keep_customer_and_product_unchanged() -> None:
    original = np.full((120, 120, 3), 100, dtype=np.uint8)
    draft = original.copy()
    coverage = np.zeros((120, 120), dtype=np.float32)
    coverage[40:80, 40:80] = 1.0
    draft[40:80, 40:80] = (212, 175, 55)
    refined = np.full_like(draft, 7)  # a model that repaints everything
    out = apply_guards(original, draft, refined, coverage)
    assert (out[:20, :20] == 100).all(), "face/background far from the piece is untouched"
    assert (out[50:70, 50:70] == (212, 175, 55)).all(), "the product core is the shop's piece"
    band = refinement_band(coverage)
    assert band[40, 60] > 0.3 and band[60, 60] == 0 and band[5, 5] == 0
    assert not NoRefinement().available


def test_photo_tips_flag_cropped_neckline_and_dark_photo() -> None:
    lm = load_fixture_landmarks("portrait_front")
    image = load_fixture_image("portrait_front", max_dimension=lm.image_width)
    image = image[:, :, :] if image.shape[1] == lm.image_width else image
    assert analyse_photo(image, lm, {JewelleryType.NECKLACE}) == []
    turned = {f.code for f in analyse_photo(image, lm, {JewelleryType.EARRINGS})}
    assert turned == {"head_turned"}
    dark = (image * 0.15).astype(np.uint8)
    codes = {f.code for f in analyse_photo(dark, lm, {JewelleryType.NECKLACE})}
    assert "too_dark" in codes
    cropped_lm = lm.scaled_to(lm.image_width, lm.image_height)
    cut = int(cropped_lm.face[152].y + 10)  # type: ignore[index]
    codes = {f.code for f in analyse_photo(image[:cut], cropped_lm, {JewelleryType.NECKLACE})}
    assert "neckline_cropped" in codes
    half = lm.scaled_to(lm.image_width // 2, lm.image_height // 2)
    assert half.face is not None and abs(half.face[1].x * 2 - lm.face[1].x) < 1e-6  # type: ignore[index]
