from __future__ import annotations

import math

import numpy as np

from jewelora_ai.datatypes import Adjustments, BodyAnchors, JewelleryType, Point, TryOnItem
from jewelora_ai.fitting.fitters import apply_affine, fit_asset
from jewelora_ai.fitting.ring_size import estimate_ring_size
from jewelora_ai.rendering.compositor import AffineCompositor, tint_metal
from tests.conftest import load_fixture_landmarks, synthetic_asset


def _neck_anchors() -> BodyAnchors:
    return BodyAnchors(
        region="neck",
        points={
            "left_end": Point(300, 400),
            "right_end": Point(500, 420),
            "center": Point(400, 410),
        },
        px_per_mm=1.0,
        rotation_deg=math.degrees(math.atan2(20, 200)),
        confidence=0.9,
    )


def test_fit_maps_asset_anchors_onto_body_anchors() -> None:
    asset = synthetic_asset(
        JewelleryType.NECKLACE, {"left_end": (0.1, 0.1), "right_end": (0.9, 0.1)}
    )
    asset.real_width_mm = None  # pure anchor fit
    placement = fit_asset(asset, _neck_anchors(), 1000, 800)
    left = apply_affine(placement.matrix, asset.anchor_px("left_end"))
    right = apply_affine(placement.matrix, asset.anchor_px("right_end"))
    assert abs(left.x - 300) < 1e-6 and abs(left.y - 400) < 1e-6
    assert abs(right.x - 500) < 1e-6 and abs(right.y - 420) < 1e-6
    x0, y0, x1, y1 = placement.bbox
    assert 0 <= x0 < x1 <= 1000 and 0 <= y0 < y1 <= 800


def test_physical_size_blends_with_anchor_fit() -> None:
    asset = synthetic_asset(
        JewelleryType.NECKLACE, {"left_end": (0.1, 0.1), "right_end": (0.9, 0.1)}
    )
    anchors = _neck_anchors()
    anchors.px_per_mm = 2.0  # physical: 150 mm → 300 px over a 400 px asset
    placement = fit_asset(asset, anchors, 1000, 800)
    scale = math.hypot(placement.matrix[0, 0], placement.matrix[1, 0])
    anchor_scale = math.hypot(200, 20) / 320  # anchor pair distance / asset anchor distance
    assert abs(scale - (300 / 400 + anchor_scale) / 2) < 1e-6


def test_adjustments_offset_scale_and_rotate() -> None:
    asset = synthetic_asset(
        JewelleryType.NECKLACE, {"left_end": (0.1, 0.1), "right_end": (0.9, 0.1)}
    )
    asset.real_width_mm = None
    base = fit_asset(asset, _neck_anchors(), 1000, 800)
    moved = fit_asset(
        asset,
        _neck_anchors(),
        1000,
        800,
        Adjustments(offset_x=30, offset_y=-10, scale=1.5, rotation_deg=10),
    )
    assert abs(moved.matrix[0, 2] - base.matrix[0, 2]) > 0
    base_scale = math.hypot(base.matrix[0, 0], base.matrix[1, 0])
    moved_scale = math.hypot(moved.matrix[0, 0], moved.matrix[1, 0])
    assert abs(moved_scale / base_scale - 1.5) < 1e-6
    centre_src = Point(asset.width / 2, asset.height * 0.1)
    c_base, c_moved = apply_affine(base.matrix, centre_src), apply_affine(moved.matrix, centre_src)
    assert abs((c_moved.x - c_base.x) - 30) < 1e-6 and abs((c_moved.y - c_base.y) + 10) < 1e-6


def test_mirrored_fit_flips_the_asset() -> None:
    asset = synthetic_asset(JewelleryType.EARRINGS, {"top": (0.3, 0.05)}, size=(200, 400))
    anchors = BodyAnchors(
        region="right_ear",
        points={"top": Point(500, 300), "oval": Point(480, 260)},
        px_per_mm=1.0,
        rotation_deg=0,
        confidence=1,
        mirror=True,
    )
    placement = fit_asset(asset, anchors, 1000, 800)
    top = apply_affine(placement.matrix, asset.anchor_px("top"))
    assert abs(top.x - 500) < 1e-6 and abs(top.y - 300) < 1e-6
    # A point to the right of the anchor in the asset ends up to the LEFT in the image.
    right_of_anchor = apply_affine(placement.matrix, Point(asset.width * 0.9, asset.height * 0.05))
    assert right_of_anchor.x < 500


def test_compositor_blends_only_where_alpha_is_set() -> None:
    image = np.full((400, 600, 3), 120, dtype=np.uint8)
    asset = synthetic_asset(
        JewelleryType.NECKLACE, {"left_end": (0.1, 0.5), "right_end": (0.9, 0.5)}
    )
    asset.real_width_mm = None
    anchors = BodyAnchors(
        region="neck",
        points={"left_end": Point(200, 200), "right_end": Point(400, 200)},
        px_per_mm=1,
        rotation_deg=0,
        confidence=1,
    )
    placement = fit_asset(asset, anchors, 600, 400)
    out = AffineCompositor(match_lighting=False, shadow_opacity=0.0).render(
        image, [(TryOnItem(asset=asset), placement)], None
    )
    assert out.shape == image.shape and out.dtype == np.uint8
    assert tuple(out[200, 300]) != (120, 120, 120), "centre of the asset is painted"
    assert tuple(out[20, 20]) == (120, 120, 120), "far corner untouched"


def test_tint_metal_changes_gold_but_not_gems() -> None:
    rgba = np.zeros((10, 10, 4), dtype=np.uint8)
    rgba[:, :5] = (214, 168, 74, 255)  # gold
    rgba[:, 5:] = (200, 20, 40, 255)  # ruby
    tinted = tint_metal(rgba, "#d6d6dc")  # white gold
    assert abs(int(tinted[0, 0, 0]) - int(tinted[0, 0, 2])) < 40, "gold region becomes near-neutral"
    assert all(
        abs(int(a) - b) <= 8 for a, b in zip(tinted[0, 9, :3], (200, 20, 40), strict=True)
    ), "ruby untouched"


def test_ring_size_estimate_is_plausible_and_labelled() -> None:
    lm = load_fixture_landmarks("hand_single")
    estimate = estimate_ring_size(lm.hands[0], "ring").to_dict()
    assert estimate["is_estimate"] is True
    assert 1 <= estimate["indian_size"] <= 30  # type: ignore[operator]
    assert 12 <= estimate["width_mm"] <= 24  # type: ignore[operator]
    assert "confirm" in str(estimate["note"]).lower()
