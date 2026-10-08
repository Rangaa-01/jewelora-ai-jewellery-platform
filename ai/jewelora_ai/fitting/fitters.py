"""Map asset anchors onto body anchors with a similarity transform (scale, rotation, shift)."""

from __future__ import annotations

import math

import numpy as np

from jewelora_ai.datatypes import (
    Adjustments,
    AssetSpec,
    BodyAnchors,
    JewelleryType,
    Placement,
    Point,
)

# Which asset anchor pair drives each region. (asset_a, asset_b, body_a, body_b)
PAIRS: dict[str, tuple[str, str, str, str]] = {
    "neck": ("left_end", "right_end", "left_end", "right_end"),
    "waist": ("left_end", "right_end", "left_end", "right_end"),
    "ankle": ("left_end", "right_end", "left_end", "right_end"),
    "finger": ("band_left", "band_right", "band_left", "band_right"),
    "wrist": ("left", "right", "left", "right"),
    "forehead": ("top", "pendant_center", "top", "pendant_center"),
}


def _region_kind(region: str) -> str:
    for kind in ("neck", "waist", "ankle", "finger", "wrist", "forehead"):
        if kind in region:
            return kind
    if "ear" in region:
        return "ear"
    if "nostril" in region:
        return "nostril"
    return region


def similarity_from_pairs(
    src_a: Point, src_b: Point, dst_a: Point, dst_b: Point
) -> tuple[float, float, Point]:
    """Scale, rotation (deg) and translation mapping segment src→dst."""
    src_v = src_b - src_a
    dst_v = dst_b - dst_a
    src_len = math.hypot(src_v.x, src_v.y) or 1.0
    dst_len = math.hypot(dst_v.x, dst_v.y)
    scale = dst_len / src_len
    rotation = math.degrees(math.atan2(dst_v.y, dst_v.x) - math.atan2(src_v.y, src_v.x))
    return scale, rotation, dst_a


def _mirror_matrix(
    scale: float, rotation_deg: float, pivot_src: Point, pivot_dst: Point, src_width: float
) -> np.ndarray:
    rad = math.radians(rotation_deg)
    c, s = math.cos(rad) * scale, math.sin(rad) * scale
    # Compose M = T(dst) · R·S · T(-pivot_mirrored) · Mirror, where Mirror: x -> width - x
    # Mirror as affine: [[-1, 0, width],[0, 1, 0]]
    mirror = np.array([[-1.0, 0.0, src_width], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]])
    pm = mirror @ np.array([pivot_src.x, pivot_src.y, 1.0])
    rs = np.array([[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]])
    t_neg = np.array([[1.0, 0.0, -pm[0]], [0.0, 1.0, -pm[1]], [0.0, 0.0, 1.0]])
    t_dst = np.array([[1.0, 0.0, pivot_dst.x], [0.0, 1.0, pivot_dst.y], [0.0, 0.0, 1.0]])
    full = t_dst @ rs @ t_neg @ mirror
    return np.asarray(full[:2, :], dtype=np.float64)


def apply_affine(matrix: np.ndarray, p: Point) -> Point:
    v = matrix @ np.array([p.x, p.y, 1.0])
    return Point(float(v[0]), float(v[1]))


def transformed_bbox(
    matrix: np.ndarray, width: int, height: int, image_w: int, image_h: int
) -> tuple[int, int, int, int]:
    corners = [
        apply_affine(matrix, Point(x, y))
        for x, y in ((0, 0), (width, 0), (0, height), (width, height))
    ]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    return (
        max(0, math.floor(min(xs))),
        max(0, math.floor(min(ys))),
        min(image_w, math.ceil(max(xs))),
        min(image_h, math.ceil(max(ys))),
    )


def fit_asset(
    asset: AssetSpec,
    anchors: BodyAnchors,
    image_w: int,
    image_h: int,
    adjustments: Adjustments | None = None,
) -> Placement:
    kind = _region_kind(anchors.region)
    adjustments = adjustments or Adjustments()
    pivot_src: Point
    pivot_dst: Point
    if kind in PAIRS and all(k in asset.anchors for k in PAIRS[kind][:2]):
        a_src, b_src, a_dst, b_dst = PAIRS[kind]
        src_a, src_b = asset.anchor_px(a_src), asset.anchor_px(b_src)
        dst_a, dst_b = anchors.points[a_dst], anchors.points[b_dst]
        scale, rotation, _ = similarity_from_pairs(src_a, src_b, dst_a, dst_b)
        # Physical size matters for neck/waist/ankle pieces; rings/bangles must fit the body.
        if asset.real_width_mm and kind in {"neck", "waist", "ankle", "forehead"}:
            physical = asset.real_width_mm * anchors.px_per_mm / asset.width
            scale = physical * 0.5 + scale * 0.5
        pivot_src = Point((src_a.x + src_b.x) / 2, (src_a.y + src_b.y) / 2)
        pivot_dst = Point((dst_a.x + dst_b.x) / 2, (dst_a.y + dst_b.y) / 2)
    elif kind == "ear":
        pivot_src = asset.anchor_px("top") if "top" in asset.anchors else Point(asset.width / 2, 0)
        pivot_dst = anchors.points["top"]
        rotation = anchors.rotation_deg
        if asset.real_height_mm:
            scale = asset.real_height_mm * anchors.px_per_mm / asset.height
        else:
            # ~5 cm earring relative to face width
            scale = (anchors.points["oval"].distance_to(anchors.points["top"]) * 1.6) / asset.height
    elif kind == "nostril":
        pivot_src = (
            asset.anchor_px("pivot")
            if "pivot" in asset.anchors
            else Point(asset.width * 0.25, asset.height * 0.25)
        )
        pivot_dst = anchors.points["pivot"]
        rotation = anchors.rotation_deg
        scale = (asset.real_width_mm or 12.0) * anchors.px_per_mm / asset.width
    else:
        raise ValueError(f"no fitting strategy for region {anchors.region}")

    scale *= adjustments.scale
    rotation += adjustments.rotation_deg
    pivot_dst = Point(pivot_dst.x + adjustments.offset_x, pivot_dst.y + adjustments.offset_y)
    if anchors.mirror:
        matrix = _mirror_matrix(scale, rotation, pivot_src, pivot_dst, asset.width)
    else:
        matrix = _plain_matrix(scale, rotation, pivot_src, pivot_dst)
    if anchors.squash_x != 1.0:
        q = anchors.squash_x
        matrix = matrix.copy()
        matrix[0, 0] *= q
        matrix[0, 1] *= q
        matrix[0, 2] = q * matrix[0, 2] + (1.0 - q) * pivot_dst.x
    bbox = transformed_bbox(matrix, asset.width, asset.height, image_w, image_h)
    return Placement(
        region=anchors.region,
        matrix=matrix,
        bbox=bbox,
        confidence=anchors.confidence,
        occlusion=dict(anchors.occlusion),
        asset_id=asset.asset_id,
    )


def _plain_matrix(
    scale: float, rotation_deg: float, pivot_src: Point, pivot_dst: Point
) -> np.ndarray:
    rad = math.radians(rotation_deg)
    c, s = math.cos(rad) * scale, math.sin(rad) * scale
    tx = pivot_dst.x - (c * pivot_src.x - s * pivot_src.y)
    ty = pivot_dst.y - (s * pivot_src.x + c * pivot_src.y)
    return np.array([[c, -s, tx], [s, c, ty]], dtype=np.float64)


def default_slot(jewellery_type: JewelleryType) -> str:
    return {
        JewelleryType.RING: "right_ring",
        JewelleryType.BANGLE: "right_wrist",
        JewelleryType.BRACELET: "right_wrist",
        JewelleryType.NOSE_RING: "left_nostril",
        JewelleryType.ANKLET: "left_ankle",
    }.get(jewellery_type, jewellery_type.value)
