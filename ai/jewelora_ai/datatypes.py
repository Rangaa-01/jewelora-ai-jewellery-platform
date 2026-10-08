"""Core data types shared across the try-on pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

import numpy as np


class JewelleryType(StrEnum):
    NECKLACE = "necklace"
    CHAIN = "chain"
    PENDANT = "pendant"
    HARAM = "haram"
    CHOKER = "choker"
    EARRINGS = "earrings"
    RING = "ring"
    BANGLE = "bangle"
    BRACELET = "bracelet"
    NOSE_RING = "nose_ring"
    MAANG_TIKKA = "maang_tikka"
    WAIST_CHAIN = "waist_chain"
    ANKLET = "anklet"


NECK_TYPES = frozenset(
    {
        JewelleryType.NECKLACE,
        JewelleryType.CHAIN,
        JewelleryType.PENDANT,
        JewelleryType.HARAM,
        JewelleryType.CHOKER,
    }
)
WRIST_TYPES = frozenset({JewelleryType.BANGLE, JewelleryType.BRACELET})


@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def as_tuple(self) -> tuple[float, float]:
        return (self.x, self.y)

    def __add__(self, other: Point) -> Point:
        return Point(self.x + other.x, self.y + other.y)

    def __sub__(self, other: Point) -> Point:
        return Point(self.x - other.x, self.y - other.y)

    def scaled(self, k: float) -> Point:
        return Point(self.x * k, self.y * k)

    def distance_to(self, other: Point) -> float:
        return float(np.hypot(self.x - other.x, self.y - other.y))


def midpoint(a: Point, b: Point) -> Point:
    return Point((a.x + b.x) / 2, (a.y + b.y) / 2)


def lerp(a: Point, b: Point, t: float) -> Point:
    return Point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)


@dataclass
class Hand:
    points: list[Point]  # 21 MediaPipe hand landmarks in pixels
    handedness: str  # "Left" | "Right" (the person's hand)
    score: float
    world_points: list[tuple[float, float, float]] | None = None


@dataclass
class Landmarks:
    """Everything the detectors found, in pixel coordinates of the preprocessed image."""

    image_width: int
    image_height: int
    face: list[Point] | None = None  # 478 points
    face_score: float = 0.0
    face_transform: np.ndarray | None = None  # 4x4 facial transformation matrix
    hands: list[Hand] = field(default_factory=list)
    pose: list[Point] | None = None  # 33 points
    pose_visibility: list[float] | None = None

    def scaled_to(self, width: int, height: int) -> Landmarks:
        """The same detection expressed in the pixels of a resized copy of the image."""
        if width == self.image_width and height == self.image_height:
            return self
        sx, sy = width / self.image_width, height / self.image_height

        def pts(points: list[Point] | None) -> list[Point] | None:
            return None if points is None else [Point(p.x * sx, p.y * sy) for p in points]

        return Landmarks(
            image_width=width,
            image_height=height,
            face=pts(self.face),
            face_score=self.face_score,
            face_transform=self.face_transform,
            hands=[
                Hand(
                    points=pts(h.points) or [],
                    handedness=h.handedness,
                    score=h.score,
                    world_points=h.world_points,
                )
                for h in self.hands
            ],
            pose=pts(self.pose),
            pose_visibility=self.pose_visibility,
        )

    def summary(self) -> dict[str, Any]:
        return {
            "image": {"width": self.image_width, "height": self.image_height},
            "face": self.face is not None,
            "hands": [{"handedness": h.handedness, "score": round(h.score, 3)} for h in self.hands],
            "pose": self.pose is not None,
        }


@dataclass
class SegmentationMasks:
    """Float32 confidence masks in [0,1] at image resolution (H, W)."""

    hair: np.ndarray | None = None
    body_skin: np.ndarray | None = None
    face_skin: np.ndarray | None = None
    clothes: np.ndarray | None = None
    background: np.ndarray | None = None


@dataclass
class AssetSpec:
    """A transparent jewellery image plus the metadata needed to fit it."""

    image: np.ndarray  # RGBA uint8 (H, W, 4)
    anchors: dict[str, Point]  # normalised 0..1 asset coordinates
    jewellery_type: JewelleryType
    real_width_mm: float | None = None
    real_height_mm: float | None = None
    asset_id: str | None = None

    @property
    def width(self) -> int:
        return int(self.image.shape[1])

    @property
    def height(self) -> int:
        return int(self.image.shape[0])

    def anchor_px(self, name: str) -> Point:
        a = self.anchors[name]
        return Point(a.x * self.width, a.y * self.height)


@dataclass
class Adjustments:
    """Manual corrections a customer makes in the UI, applied on top of the fitted placement."""

    offset_x: float = 0.0  # pixels in the output image
    offset_y: float = 0.0
    scale: float = 1.0  # multiplier
    rotation_deg: float = 0.0  # additional rotation about the placement centre


@dataclass
class BodyAnchors:
    """Named target points in image space for one placement, plus scale/rotation hints."""

    region: str  # e.g. "neck", "left_ear", "right_ear", "ring_finger_left"
    points: dict[str, Point]
    px_per_mm: float
    rotation_deg: float
    confidence: float
    mirror: bool = False  # flip the asset horizontally (e.g. the other ear)
    occlusion: dict[str, float] = field(default_factory=dict)  # mask name -> strength
    # Horizontal foreshortening about the pivot (1 = facing the camera). Earrings on a
    # turned head are seen partly edge-on, so they narrow with the head's yaw.
    squash_x: float = 1.0


@dataclass
class Placement:
    region: str
    matrix: np.ndarray  # 2x3 affine mapping asset pixels -> image pixels
    bbox: tuple[int, int, int, int]  # x0, y0, x1, y1 in image space
    confidence: float
    occlusion: dict[str, float]
    asset_id: str | None = None
    # Strand warp: (x0, x1, 2x3 affine) per vertical strip of the asset. Empty = rigid.
    strips: list[tuple[int, int, np.ndarray]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "region": self.region,
            "matrix": [[float(v) for v in row] for row in self.matrix],
            "bbox": list(self.bbox),
            "confidence": round(float(self.confidence), 3),
            "asset_id": self.asset_id,
            "strips": [
                {"x0": x0, "x1": x1, "matrix": [[float(v) for v in row] for row in m]}
                for x0, x1, m in self.strips
            ],
        }


@dataclass
class TryOnItem:
    asset: AssetSpec
    slot: str | None = None  # e.g. "ring_left_ring", "earrings"; None = default slot for the type
    adjustments: Adjustments = field(default_factory=Adjustments)
    tint_hex: str | None = None  # recolour metal (variant switching) before rendering
    length_mm: float | None = None  # chosen necklace/chain length (drives the drop)


@dataclass
class TryOnRequest:
    image: np.ndarray  # RGB uint8 (H, W, 3), already preprocessed
    items: list[TryOnItem]
    landmarks: Landmarks | None = None  # reuse cached detection when provided
    masks: SegmentationMasks | None = None
    quality: str = "standard"  # "fast" | "standard" | "premium" (see AffineCompositor)


@dataclass
class TryOnResult:
    image: np.ndarray  # RGB uint8 composite
    placements: list[Placement]
    landmarks: Landmarks
    warnings: list[str]
    confidence: float
    engine_version: str
    processing_ms: int
    ring_size_estimate: dict[str, Any] | None = None
    coverage: np.ndarray | None = None  # 0..1 jewellery coverage, for refinement guards
