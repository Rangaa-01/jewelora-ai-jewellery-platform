"""Anchor geometry on replayed landmarks (no MediaPipe needed)."""

from __future__ import annotations

import pytest

from jewelora_ai.datatypes import JewelleryType, Landmarks
from jewelora_ai.fitting.anchors import (
    AnchorError,
    anchors_for,
    face_yaw_ratio,
    ring_anchors,
    wrist_anchors,
)
from tests.conftest import load_fixture_landmarks


def _inside(lm: Landmarks, x: float, y: float) -> bool:
    return 0 <= x <= lm.image_width and 0 <= y <= lm.image_height


def test_neck_anchors_sit_below_chin_and_inside_image() -> None:
    lm = load_fixture_landmarks("portrait_front")
    assert lm.face is not None
    (neck,) = anchors_for(lm, JewelleryType.NECKLACE)
    chin = lm.face[152]
    assert neck.points["center"].y > chin.y
    assert neck.points["left_end"].x < neck.points["right_end"].x
    for p in neck.points.values():
        assert _inside(lm, p.x, p.y)
    assert neck.confidence >= 0.9, "shoulders are visible so the pose branch should be used"
    assert 0.4 < neck.px_per_mm < 1.2


def test_neck_anchors_fall_back_when_pose_shoulders_are_implausible() -> None:
    lm = load_fixture_landmarks("portrait_ears")  # pose shoulders detected off-image
    (neck,) = anchors_for(lm, JewelleryType.CHOKER)
    assert lm.face is not None
    assert neck.points["center"].y > lm.face[152].y, "must hang below the chin, not on the forehead"
    assert neck.confidence < 0.9


def test_turned_head_places_only_the_visible_ear() -> None:
    front = load_fixture_landmarks("portrait_front")  # nose towards image-right → right ear hidden
    regions = {a.region for a in anchors_for(front, JewelleryType.EARRINGS)}
    assert regions == {"left_ear"}
    assert face_yaw_ratio(front) > 0

    ears = load_fixture_landmarks("portrait_ears")  # strong turn the other way
    regions = {a.region for a in anchors_for(ears, JewelleryType.EARRINGS)}
    assert regions == {"right_ear"}
    (ear,) = anchors_for(ears, JewelleryType.EARRINGS)
    assert ear.mirror is True
    assert ear.points["top"].x > ears.face[454].x  # type: ignore[index]


def test_maang_tikka_runs_along_the_face_axis() -> None:
    lm = load_fixture_landmarks("portrait_ears")
    (tikka,) = anchors_for(lm, JewelleryType.MAANG_TIKKA)
    top, pendant = tikka.points["top"], tikka.points["pendant_center"]
    assert lm.face is not None
    assert top.y < lm.face[10].y < pendant.y < lm.face[9].y


def test_ring_and_wrist_anchors_follow_the_finger() -> None:
    lm = load_fixture_landmarks("hand_single")
    hand = lm.hands[0]
    ring = ring_anchors(hand, "ring")
    width = ring.points["band_left"].distance_to(ring.points["band_right"])
    assert 20 < width < 200
    mcp, pip = hand.points[13], hand.points[14]
    centre = ring.points["center"]
    assert min(mcp.x, pip.x) - 5 <= centre.x <= max(mcp.x, pip.x) + 5
    wrist = wrist_anchors(hand)
    assert wrist.points["left"].distance_to(wrist.points["right"]) > width


def test_missing_landmarks_raise_clear_errors() -> None:
    face_only = load_fixture_landmarks("portrait_front")
    face_only.hands = []
    with pytest.raises(AnchorError, match="no_hand"):
        anchors_for(face_only, JewelleryType.RING)
    hands_only = load_fixture_landmarks("hands_flowers")
    with pytest.raises(AnchorError, match="no_face"):
        anchors_for(hands_only, JewelleryType.NECKLACE)
    with pytest.raises(AnchorError, match="hips_not_visible"):
        anchors_for(hands_only, JewelleryType.WAIST_CHAIN)


def test_slot_selects_hand_and_finger() -> None:
    lm = load_fixture_landmarks("hands_flowers")
    (right_index,) = anchors_for(lm, JewelleryType.RING, "right_index")
    (right_ring,) = anchors_for(lm, JewelleryType.RING, "right_ring")
    assert right_index.region == "right_index_finger"
    assert right_ring.region == "right_ring_finger"
    assert right_index.points["center"] != right_ring.points["center"]
