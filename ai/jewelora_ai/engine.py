"""The try-on engine: detection → fitting → rendering."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from jewelora_ai.datatypes import (
    JewelleryType,
    Landmarks,
    Placement,
    SegmentationMasks,
    TryOnItem,
    TryOnRequest,
    TryOnResult,
)
from jewelora_ai.fitting.anchors import AnchorError, anchors_for, pick_hand
from jewelora_ai.fitting.fitters import fit_asset
from jewelora_ai.fitting.ring_size import estimate_ring_size
from jewelora_ai.interfaces import LandmarkDetector, Renderer, Segmenter
from jewelora_ai.rendering.compositor import AffineCompositor
from jewelora_ai.segmentation.mediapipe_segmenter import NullSegmenter

ENGINE_VERSION = "affine-mediapipe-1.0"

# Customer-facing explanations for anchor failures.
WARNING_MESSAGES = {
    "no_face": (
        "We couldn't find a face in this photo. "
        "Use a clear, front-facing photo for necklaces, earrings and tikkas."
    ),
    "ears_not_visible": "Your ears aren't visible in this photo, so earrings couldn't be placed.",
    "face_too_small": "Your face is quite small in this photo. Try a closer shot.",
    "no_hand": (
        "We couldn't find a hand in this photo. "
        "Show the back of your hand with fingers spread for rings and bangles."
    ),
    "finger_not_visible": "That finger isn't clearly visible. Try spreading your fingers.",
    "hand_too_small": "Your hand is quite small in this photo. Try a closer shot.",
    "hips_not_visible": "Waist chains need a photo showing your waist and hips.",
    "ankle_not_visible": "Anklets need a photo showing your ankles.",
}


class TryOnError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class TryOnEngine:
    detector: LandmarkDetector
    segmenter: Segmenter = field(default_factory=NullSegmenter)
    renderer: Renderer = field(default_factory=AffineCompositor)

    def detect(self, image_rgb: np.ndarray) -> Landmarks:
        return self.detector.detect(image_rgb)

    def segment(self, image_rgb: np.ndarray) -> SegmentationMasks:
        return self.segmenter.segment(image_rgb)

    def place(
        self, landmarks: Landmarks, items: list[TryOnItem]
    ) -> tuple[list[tuple[TryOnItem, Placement]], list[str], list[str]]:
        """Returns (placed items, customer-facing warnings, anchor error codes)."""
        placed: list[tuple[TryOnItem, Placement]] = []
        warnings: list[str] = []
        codes: list[str] = []
        for item in items:
            try:
                anchor_sets = anchors_for(landmarks, item.asset.jewellery_type, item.slot)
            except AnchorError as exc:
                code = str(exc).split(":")[0]
                codes.append(code)
                warnings.append(
                    WARNING_MESSAGES.get(code, "This piece couldn't be placed on this photo.")
                )
                continue
            for anchors in anchor_sets:
                placement = fit_asset(
                    item.asset,
                    anchors,
                    landmarks.image_width,
                    landmarks.image_height,
                    item.adjustments,
                )
                placed.append((item, placement))
        return placed, warnings, codes

    def run(self, request: TryOnRequest) -> TryOnResult:
        started = time.perf_counter()
        landmarks = request.landmarks or self.detect(request.image)
        placed, warnings, codes = self.place(landmarks, request.items)
        if not placed:
            code = codes[0] if len(set(codes)) == 1 else "nothing_placed"
            raise TryOnError(
                code, warnings[0] if warnings else "We couldn't place this jewellery on your photo."
            )
        masks = request.masks
        if masks is None and any(p.occlusion for _, p in placed):
            masks = self.segment(request.image)
        # Draw larger/behind pieces first so rings/earrings sit above necklaces when overlapping.
        order = {
            JewelleryType.WAIST_CHAIN: 0,
            JewelleryType.HARAM: 1,
            JewelleryType.NECKLACE: 2,
            JewelleryType.CHAIN: 2,
        }
        placed.sort(key=lambda ip: order.get(ip[0].asset.jewellery_type, 5))
        composite = self.renderer.render(request.image, placed, masks)
        ring_size = None
        if any(i.asset.jewellery_type == JewelleryType.RING for i, _ in placed) and landmarks.hands:
            ring_item = next(i for i, _ in placed if i.asset.jewellery_type == JewelleryType.RING)
            hand = pick_hand(landmarks, ring_item.slot)
            finger = (ring_item.slot or "ring").split("_")[-1]
            ring_size = estimate_ring_size(
                hand, finger if finger in {"index", "middle", "ring", "pinky"} else "ring"
            ).to_dict()
        confidence = float(np.mean([p.confidence for _, p in placed]))
        return TryOnResult(
            image=composite,
            placements=[p for _, p in placed],
            landmarks=landmarks,
            warnings=warnings,
            confidence=confidence,
            engine_version=ENGINE_VERSION,
            processing_ms=int((time.perf_counter() - started) * 1000),
            ring_size_estimate=ring_size,
        )
