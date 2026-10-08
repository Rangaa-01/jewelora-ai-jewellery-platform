"""Stage interfaces. Every stage has a production and a deterministic test implementation."""

from __future__ import annotations

from typing import Protocol

import numpy as np

from jewelora_ai.datatypes import (
    AssetSpec,
    BodyAnchors,
    Landmarks,
    Placement,
    SegmentationMasks,
    TryOnItem,
)


class LandmarkDetector(Protocol):
    def detect(self, image_rgb: np.ndarray) -> Landmarks: ...


class Segmenter(Protocol):
    def segment(self, image_rgb: np.ndarray) -> SegmentationMasks: ...


class Fitter(Protocol):
    """Turns body anchors + an asset into a concrete placement transform."""

    def fit(self, asset: AssetSpec, anchors: BodyAnchors) -> Placement: ...


class Renderer(Protocol):
    """Composites placed assets onto the image. See rendering/README.md for other renderers."""

    def render(
        self,
        image_rgb: np.ndarray,
        items: list[tuple[TryOnItem, Placement]],
        masks: SegmentationMasks | None,
        quality: str = "standard",
    ) -> np.ndarray: ...
