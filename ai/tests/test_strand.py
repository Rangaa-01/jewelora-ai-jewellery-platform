"""Strand warp: strips follow the neck arc, ends land on the neck base, pendants hang down."""

from __future__ import annotations

import math

import numpy as np

from jewelora_ai.datatypes import Adjustments, JewelleryType, Point
from jewelora_ai.fitting.anchors import anchors_for
from jewelora_ai.fitting.fitters import apply_affine
from jewelora_ai.fitting.strand import (
    chord_clip_row,
    parabola,
    plan_strips,
    strand_placement,
    target_arc,
)
from tests.conftest import load_fixture_landmarks, synthetic_asset

NECK_ANCHORS = {"left_end": (0.06, 0.28), "right_end": (0.94, 0.27), "bottom": (0.49, 0.94)}


def _necklace():  # type: ignore[no-untyped-def]
    asset = synthetic_asset(JewelleryType.NECKLACE, NECK_ANCHORS, size=(1000, 800))
    asset.real_width_mm = 150.0
    return asset


def test_parabola_passes_through_points() -> None:
    p, q, r = parabola(Point(0, 0), Point(5, 10), Point(10, 0))
    for x, y in ((0, 0), (5, 10), (10, 0)):
        assert abs(p * x * x + q * x + r - y) < 1e-9


def test_strips_map_ends_onto_neck_base_and_bottom_hangs_below() -> None:
    lm = load_fixture_landmarks("portrait_front")
    (neck,) = anchors_for(lm, JewelleryType.NECKLACE)
    asset = _necklace()
    strips = plan_strips(asset, neck, length_mm=457.0)
    assert len(strips) == 28
    t_left, t_bottom, t_right = target_arc(asset, neck, length_mm=457.0, jewellery_type="necklace")
    first = apply_affine(strips[0].matrix, asset.anchor_px("left_end"))
    last = apply_affine(strips[-1].matrix, asset.anchor_px("right_end"))
    assert first.distance_to(t_left) < 12 and last.distance_to(t_right) < 12
    middle = apply_affine(strips[len(strips) // 2].matrix, asset.anchor_px("bottom"))
    assert middle.distance_to(t_bottom) < 12
    # the drop is below the chord in image space
    assert t_bottom.y > (t_left.y + t_right.y) / 2
    # every strip keeps its proportions (no squash): singular values nearly equal
    for strip in strips:
        sv = np.linalg.svd(strip.matrix[:, :2], compute_uv=False)
        assert sv[0] / sv[1] < 1.01


def test_longer_size_hangs_lower_and_adjustments_shift_the_arc() -> None:
    lm = load_fixture_landmarks("portrait_front")
    (neck,) = anchors_for(lm, JewelleryType.NECKLACE)
    asset = _necklace()
    short = target_arc(asset, neck, length_mm=406.0, jewellery_type="necklace")[1]
    long = target_arc(asset, neck, length_mm=559.0, jewellery_type="necklace")[1]
    assert long.y > short.y
    base = strand_placement(asset, neck, lm.image_width, lm.image_height)
    moved = strand_placement(
        asset, neck, lm.image_width, lm.image_height, adjustments=Adjustments(offset_y=40)
    )
    assert moved.bbox[1] - base.bbox[1] > 30
    assert len(base.strips) == 28 and base.to_dict()["strips"][0]["x0"] == 0


def test_chord_clip_removes_the_back_of_a_loop() -> None:
    asset = _necklace()
    rows = chord_clip_row(asset)
    assert len(rows) == asset.width
    assert math.isclose(
        rows[int(asset.width * 0.06)], 0.28 * asset.height - asset.height * 0.02, abs_tol=2
    )
