from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from jewelora_ai.datatypes import AssetSpec, JewelleryType, Landmarks, Point
from jewelora_ai.detectors.fixture_detector import landmarks_from_json
from jewelora_ai.models import models_available

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture_landmarks(name: str) -> Landmarks:
    return landmarks_from_json(json.loads((FIXTURES / f"{name}.landmarks.json").read_text()))


def load_fixture_image(name: str, max_dimension: int = 1200) -> np.ndarray:
    from jewelora_ai.preprocessing import load_rgb

    return load_rgb((FIXTURES / f"{name}.jpg").read_bytes(), max_dimension=max_dimension).rgb


def synthetic_asset(
    jewellery_type: JewelleryType,
    anchors: dict[str, tuple[float, float]],
    size: tuple[int, int] = (400, 300),
) -> AssetSpec:
    """An opaque gold rectangle with a transparent border; enough to test fitting/rendering."""
    w, h = size
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    inner = Image.new("RGBA", (w - 40, h - 40), (214, 168, 74, 255))
    img.paste(inner, (20, 20))
    return AssetSpec(
        image=np.asarray(img),
        anchors={k: Point(*v) for k, v in anchors.items()},
        jewellery_type=jewellery_type,
        real_width_mm=150.0,
        real_height_mm=150.0 * h / w,
        asset_id="synthetic",
    )


requires_models = pytest.mark.skipif(
    not models_available(), reason="MediaPipe models not downloaded"
)


@pytest.fixture(scope="session")
def mediapipe_engine():  # type: ignore[no-untyped-def]
    if not models_available():
        pytest.skip("MediaPipe models not downloaded")
    from jewelora_ai.detectors.mediapipe_detector import MediaPipeLandmarkDetector
    from jewelora_ai.engine import TryOnEngine
    from jewelora_ai.segmentation.mediapipe_segmenter import MediaPipeSegmenter

    return TryOnEngine(detector=MediaPipeLandmarkDetector(), segmenter=MediaPipeSegmenter())
