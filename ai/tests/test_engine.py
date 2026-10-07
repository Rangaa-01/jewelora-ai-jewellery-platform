from __future__ import annotations

import numpy as np
import pytest

from jewelora_ai.datatypes import JewelleryType, TryOnItem, TryOnRequest
from jewelora_ai.detectors.fixture_detector import FixtureLandmarkDetector, NullLandmarkDetector
from jewelora_ai.engine import ENGINE_VERSION, TryOnEngine, TryOnError
from jewelora_ai.preprocessing import InvalidImageError, encode_image, load_rgb
from tests.conftest import (
    load_fixture_image,
    load_fixture_landmarks,
    requires_models,
    synthetic_asset,
)


def _engine_for(name: str) -> TryOnEngine:
    return TryOnEngine(detector=FixtureLandmarkDetector(load_fixture_landmarks(name)))


def test_engine_places_multiple_items_and_reports_warnings() -> None:
    image = load_fixture_image("portrait_front")
    engine = _engine_for("portrait_front")
    items = [
        TryOnItem(
            asset=synthetic_asset(
                JewelleryType.NECKLACE, {"left_end": (0.1, 0.1), "right_end": (0.9, 0.1)}
            )
        ),
        TryOnItem(
            asset=synthetic_asset(JewelleryType.EARRINGS, {"top": (0.5, 0.05)}, size=(100, 200))
        ),
        TryOnItem(
            asset=synthetic_asset(
                JewelleryType.RING, {"band_left": (0.1, 0.5), "band_right": (0.9, 0.5)}
            )
        ),
    ]
    result = engine.run(TryOnRequest(image=image, items=items))
    regions = [p.region for p in result.placements]
    assert "neck" in regions and "left_ear" in regions
    assert any("hand" in w for w in result.warnings), "ring on a face photo must warn, not fail"
    assert result.engine_version == ENGINE_VERSION
    assert result.image.shape == image.shape
    assert 0 < result.confidence <= 1
    assert result.processing_ms >= 0


def test_engine_fails_cleanly_when_nothing_can_be_placed() -> None:
    image = np.zeros((300, 300, 3), dtype=np.uint8)
    engine = TryOnEngine(detector=NullLandmarkDetector())
    with pytest.raises(TryOnError) as exc:
        engine.run(
            TryOnRequest(
                image=image,
                items=[
                    TryOnItem(
                        asset=synthetic_asset(
                            JewelleryType.NECKLACE,
                            {"left_end": (0.1, 0.1), "right_end": (0.9, 0.1)},
                        )
                    )
                ],
            )
        )
    assert exc.value.code == "nothing_placed"
    assert "face" in exc.value.message


def test_ring_photo_returns_size_estimate() -> None:
    image = load_fixture_image("hand_single")
    engine = _engine_for("hand_single")
    result = engine.run(
        TryOnRequest(
            image=image,
            items=[
                TryOnItem(
                    asset=synthetic_asset(
                        JewelleryType.RING, {"band_left": (0.1, 0.5), "band_right": (0.9, 0.5)}
                    )
                )
            ],
        )
    )
    assert result.ring_size_estimate is not None
    assert result.ring_size_estimate["is_estimate"] is True


def test_preprocessing_rejects_garbage_and_resizes() -> None:
    with pytest.raises(InvalidImageError):
        load_rgb(b"not an image")
    pre = load_rgb(
        encode_image(np.zeros((1000, 2000, 3), dtype=np.uint8), fmt="PNG"), max_dimension=500
    )
    assert pre.rgb.shape[1] == 500 and abs(pre.scale - 0.25) < 1e-9
    with pytest.raises(InvalidImageError):
        load_rgb(encode_image(np.zeros((100, 100, 3), dtype=np.uint8), fmt="PNG"))


@requires_models
def test_mediapipe_detects_fixture_photos(mediapipe_engine: TryOnEngine) -> None:
    face = mediapipe_engine.detect(load_fixture_image("portrait_front"))
    assert face.face is not None and len(face.face) == 478
    assert face.pose is not None
    hands = mediapipe_engine.detect(load_fixture_image("hands_flowers"))
    assert hands.hands and all(len(h.points) == 21 for h in hands.hands)
    assert hands.hands[0].world_points is not None


@requires_models
def test_mediapipe_segmenter_returns_masks(mediapipe_engine: TryOnEngine) -> None:
    image = load_fixture_image("portrait_front")
    masks = mediapipe_engine.segment(image)
    assert masks.hair is not None and masks.hair.shape == image.shape[:2]
    assert 0.0 <= float(masks.hair.max()) <= 1.0
    assert float(masks.hair.mean()) > 0.05, "long hair should cover a visible fraction"
