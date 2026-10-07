"""Ring size estimation from hand landmarks. Always an estimate."""

from __future__ import annotations

import math
from dataclasses import dataclass

from jewelora_ai.datatypes import Hand
from jewelora_ai.fitting.anchors import finger_width_px, hand_scale

# Indian ring size chart: size ~ circumference_mm - 40 (size 10 → 50 mm, size 20 → 60 mm).
INDIAN_SIZE_OFFSET_MM = 40.0


@dataclass(frozen=True)
class RingSizeEstimate:
    finger: str
    handedness: str
    width_mm: float
    inner_diameter_mm: float
    circumference_mm: float
    indian_size: int
    us_size: float
    confidence: str  # "low" | "medium"
    note: str

    def to_dict(self) -> dict[str, object]:
        return {
            "finger": self.finger,
            "handedness": self.handedness,
            "width_mm": round(self.width_mm, 1),
            "inner_diameter_mm": round(self.inner_diameter_mm, 1),
            "circumference_mm": round(self.circumference_mm, 1),
            "indian_size": self.indian_size,
            "us_size": self.us_size,
            "confidence": self.confidence,
            "is_estimate": True,
            "note": self.note,
        }


MCP_SPACING_TO_FINGER_WIDTH = 0.78  # knuckle centre spacing (pixels) vs finger width
# MediaPipe world landmarks are expressed in the model's canonical hand scale, which runs a
# little small; empirically the metric knuckle spacing matches the finger width directly.
# TUNABLE: validate against measured customers before relying on it (see docs/ai-tryon.md).
WORLD_SPACING_TO_FINGER_WIDTH = 1.0
_NEIGHBOURS = {"index": (5, 9, 9), "middle": (5, 9, 13), "ring": (9, 13, 17), "pinky": (13, 17, 17)}


def _world_width_mm(hand: Hand, finger: str) -> float | None:
    """Finger width from MediaPipe's metric world landmarks (robust to perspective)."""
    if not hand.world_points:
        return None
    a, b, c = _NEIGHBOURS[finger]
    pts = hand.world_points

    def dist(i: int, j: int) -> float:
        return math.dist(pts[i], pts[j]) * 1000.0

    spacing = (dist(a, b) + dist(b, c)) / 2 if a != b and b != c else dist(a, c)
    if spacing <= 0:
        return None
    return spacing * WORLD_SPACING_TO_FINGER_WIDTH


def estimate_ring_size(hand: Hand, finger: str = "ring") -> RingSizeEstimate:
    width_mm = _world_width_mm(hand, finger)
    confidence = "medium"
    if width_mm is None:
        px_per_mm = hand_scale(hand)
        width_mm = finger_width_px(hand, finger) / px_per_mm * MCP_SPACING_TO_FINGER_WIDTH
        confidence = "low"
    width_mm = max(12.0, min(width_mm, 24.0))
    # Fingers are slightly oval; the ring's inner diameter is close to the visible width.
    diameter = width_mm * 0.98
    circumference = math.pi * diameter
    indian = round(circumference - INDIAN_SIZE_OFFSET_MM)
    indian = max(1, min(indian, 30))
    us = round((circumference - 36.5) / 2.55 * 2) / 2  # US sizes step 2.55 mm, half sizes
    return RingSizeEstimate(
        finger=finger,
        handedness=hand.handedness,
        width_mm=width_mm,
        inner_diameter_mm=diameter,
        circumference_mm=circumference,
        indian_size=indian,
        us_size=max(3.0, min(us, 15.0)),
        confidence=confidence if hand.score > 0.8 else "low",
        note=(
            "Estimated from a photo using average hand proportions. "
            "Please confirm your size in store before purchase."
        ),
    )
