"""Strand warp for neck pieces (necklaces, chains, pendants, harams, chokers, waist/ankle).

A rigid transform cannot make a necklace *drape*: the top ends must sit on the neck base,
the strand must follow the chest curve and the pendant must hang straight down. We split
the asset into vertical strips along its own strand arc (a parabola through the asset's
``left_end``, ``bottom`` and ``right_end`` anchors) and map each strip onto the target arc
(a parabola through the body's neck-base points and a drop computed from the necklace
length). Each strip is an affine piece, which both the Python compositor and the browser
canvas can draw identically.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from jewelora_ai.datatypes import Adjustments, AssetSpec, BodyAnchors, Placement, Point

STRIPS = 28
# Fraction of the full circumference that hangs visibly in front of the neck.
FRONT_ARC_FRACTION = 0.55
DEFAULT_LENGTH_MM = {
    "choker": 380.0,
    "necklace": 457.0,
    "chain": 508.0,
    "pendant": 457.0,
    "haram": 711.0,
    "waist_chain": 820.0,
    "anklet": 254.0,
}


@dataclass(frozen=True)
class Strip:
    """One vertical slice of the asset and the affine that places it."""

    x0: int
    x1: int
    matrix: np.ndarray  # 2x3 asset-pixels -> image-pixels


def parabola(a: Point, b: Point, c: Point) -> tuple[float, float, float]:
    """Coefficients of y = p*x^2 + q*x + r through three points (x distinct)."""
    m = np.array([[a.x**2, a.x, 1.0], [b.x**2, b.x, 1.0], [c.x**2, c.x, 1.0]])
    try:
        p, q, r = np.linalg.solve(m, np.array([a.y, b.y, c.y]))
    except np.linalg.LinAlgError:
        p, q, r = 0.0, 0.0, (a.y + b.y + c.y) / 3
    return float(p), float(q), float(r)


def drop_for_length(chord_mm: float, length_mm: float) -> float:
    """How far below the neck base the strand's lowest point hangs, from the arc length.

    Front arc length ~ FRONT_ARC_FRACTION of the circumference; parabola arc length
    ~ chord + 8h^2/(3 chord)  =>  h = sqrt(3 chord (arc - chord) / 8).
    """
    arc = max(length_mm * FRONT_ARC_FRACTION, chord_mm * 1.05)
    return math.sqrt(max(0.0, 3.0 * chord_mm * (arc - chord_mm) / 8.0))


def _source_arc(asset: AssetSpec) -> tuple[Point, Point, Point]:
    left, right = asset.anchor_px("left_end"), asset.anchor_px("right_end")
    if "bottom" in asset.anchors:
        bottom = asset.anchor_px("bottom")
    else:
        bottom = Point((left.x + right.x) / 2, asset.height * 0.95)
    return left, bottom, right


def target_arc(
    asset: AssetSpec,
    anchors: BodyAnchors,
    *,
    length_mm: float | None,
    jewellery_type: str,
) -> tuple[Point, Point, Point]:
    """Where the piece's top ends and lowest point land, in image space.

    The top ends sit on the neck base (the body chord). The hang depth comes from the
    piece itself: the photographed asset already shows how it drapes, so its depth is
    scaled with the chord. Choosing a longer or shorter size stretches the drop in
    proportion to the product's default length.
    """
    body_left, body_right = anchors.points["left_end"], anchors.points["right_end"]
    mid = Point((body_left.x + body_right.x) / 2, (body_left.y + body_right.y) / 2)
    rad = math.radians(anchors.rotation_deg)
    along = Point(math.cos(rad), math.sin(rad))
    down = Point(-along.y, along.x)
    s_left, s_bottom, s_right = _source_arc(asset)
    body_chord = body_left.distance_to(body_right)
    src_chord = s_left.distance_to(s_right) or 1.0
    chord_px = body_chord
    if asset.real_width_mm and anchors.px_per_mm > 0:
        # The piece's real width at this person's scale. A necklace rests on the
        # collarbones, so it may sit wider than the neck base but never narrower.
        physical = src_chord * asset.real_width_mm * anchors.px_per_mm / asset.width
        chord_px = min(max(0.5 * body_chord + 0.5 * physical, body_chord), 1.5 * body_chord)
    src_depth = s_bottom.y - (s_left.y + s_right.y) / 2
    scale = chord_px / src_chord
    drop_px = max(src_depth, src_chord * 0.12) * scale
    default_len = DEFAULT_LENGTH_MM.get(jewellery_type, 457.0)
    if length_mm and default_len:
        drop_px *= min(max(length_mm / default_len, 0.6), 1.8)
    half = chord_px / 2
    left = Point(mid.x - along.x * half, mid.y - along.y * half)
    right = Point(mid.x + along.x * half, mid.y + along.y * half)
    bottom = Point(mid.x + down.x * drop_px, mid.y + down.y * drop_px)
    return left, bottom, right


def _frame(p: float, q: float, x: float, y: float) -> tuple[Point, Point]:
    """Point on the parabola and its unit tangent at x."""
    slope = 2 * p * x + q
    n = math.hypot(1.0, slope)
    return Point(x, y), Point(1.0 / n, slope / n)


def plan_strips(
    asset: AssetSpec,
    anchors: BodyAnchors,
    *,
    length_mm: float | None = None,
    adjustments: Adjustments | None = None,
    strips: int = STRIPS,
) -> list[Strip]:
    adjustments = adjustments or Adjustments()
    s_left, s_bottom, s_right = _source_arc(asset)
    t_left, t_bottom, t_right = target_arc(
        asset, anchors, length_mm=length_mm, jewellery_type=asset.jewellery_type.value
    )
    # Manual adjustments move/scale/rotate the whole target arc about its midpoint.
    if (
        adjustments.offset_x
        or adjustments.offset_y
        or adjustments.scale != 1
        or adjustments.rotation_deg
    ):
        mid = Point((t_left.x + t_right.x) / 2, (t_left.y + t_right.y) / 2)
        rad = math.radians(adjustments.rotation_deg)
        c, s = math.cos(rad) * adjustments.scale, math.sin(rad) * adjustments.scale

        def adj(p: Point) -> Point:
            dx, dy = p.x - mid.x, p.y - mid.y
            return Point(
                mid.x + c * dx - s * dy + adjustments.offset_x,
                mid.y + s * dx + c * dy + adjustments.offset_y,
            )

        t_left, t_bottom, t_right = adj(t_left), adj(t_bottom), adj(t_right)

    sp, sq, sr = parabola(s_left, s_bottom, s_right)
    # Target arc in a frame where the shoulder line is horizontal (parabola as y = f(x)).
    t_mid = Point((t_left.x + t_right.x) / 2, (t_left.y + t_right.y) / 2)
    rad = math.atan2(t_right.y - t_left.y, t_right.x - t_left.x)
    cos_r, sin_r = math.cos(rad), math.sin(rad)

    def to_local(p: Point) -> Point:
        dx, dy = p.x - t_mid.x, p.y - t_mid.y
        return Point(cos_r * dx + sin_r * dy, -sin_r * dx + cos_r * dy)

    def to_image(p: Point) -> Point:
        return Point(t_mid.x + cos_r * p.x - sin_r * p.y, t_mid.y + sin_r * p.x + cos_r * p.y)

    tl, tb, tr = to_local(t_left), to_local(t_bottom), to_local(t_right)
    tp, tq, trr = parabola(tl, tb, tr)
    src_span = s_right.x - s_left.x or 1.0
    tgt_span = tr.x - tl.x
    scale_along = tgt_span / src_span
    # The strand keeps its proportions: thickness scales exactly like the length along the arc.
    scale_normal = scale_along
    edges = np.linspace(0, asset.width, strips + 1)
    out: list[Strip] = []
    for i in range(strips):
        x0, x1 = float(edges[i]), float(edges[i + 1])
        xm = (x0 + x1) / 2
        sy = sp * xm * xm + sq * xm + sr
        _, s_tan = _frame(sp, sq, xm, sy)
        u = (xm - s_left.x) / src_span
        txl = tl.x + u * tgt_span
        tyl = tp * txl * txl + tq * txl + trr
        _, t_tan_local = _frame(tp, tq, txl, tyl)
        t_point = to_image(Point(txl, tyl))
        t_tan = Point(
            cos_r * t_tan_local.x - sin_r * t_tan_local.y,
            sin_r * t_tan_local.x + cos_r * t_tan_local.y,
        )
        # Affine: rotate the source tangent onto the target tangent, scale along/normal,
        # and map the source arc point onto the target arc point.
        src_angle = math.atan2(s_tan.y, s_tan.x)
        tgt_angle = math.atan2(t_tan.y, t_tan.x)
        # lin = R(tgt_angle) · S(along, normal) · R(-src_angle)
        ca, sa = math.cos(-src_angle), math.sin(-src_angle)
        cb, sb = math.cos(tgt_angle), math.sin(tgt_angle)
        r_in = np.array([[ca, -sa], [sa, ca]])
        scale = np.array([[scale_along, 0.0], [0.0, scale_normal]])
        r_out = np.array([[cb, -sb], [sb, cb]])
        lin = r_out @ scale @ r_in
        src = np.array([xm, sy])
        tgt = np.array([t_point.x, t_point.y])
        trans = tgt - lin @ src
        matrix = np.array(
            [[lin[0, 0], lin[0, 1], trans[0]], [lin[1, 0], lin[1, 1], trans[1]]], dtype=np.float64
        )
        out.append(Strip(x0=round(x0), x1=round(x1), matrix=matrix))
    return out


def strips_bbox(
    strips: list[Strip], height: int, image_w: int, image_h: int
) -> tuple[int, int, int, int]:
    xs: list[float] = []
    ys: list[float] = []
    for strip in strips:
        for x, y in ((strip.x0, 0), (strip.x1, 0), (strip.x0, height), (strip.x1, height)):
            v = strip.matrix @ np.array([x, y, 1.0])
            xs.append(float(v[0]))
            ys.append(float(v[1]))
    return (
        max(0, math.floor(min(xs))),
        max(0, math.floor(min(ys))),
        min(image_w, math.ceil(max(xs))),
        min(image_h, math.ceil(max(ys))),
    )


def chord_clip_row(asset: AssetSpec) -> np.ndarray:
    """Per-column y above which asset pixels are the *back* of the piece (not worn in front).

    Anything above the line joining the two top ends is discarded, so a necklace
    photographed as a full loop is worn as the front half only.
    """
    left, right = asset.anchor_px("left_end"), asset.anchor_px("right_end")
    xs = np.arange(asset.width, dtype=np.float64)
    if right.x == left.x:
        return np.full(asset.width, min(left.y, right.y))
    slope = (right.y - left.y) / (right.x - left.x)
    return left.y + slope * (xs - left.x) - asset.height * 0.02


def strand_placement(
    asset: AssetSpec,
    anchors: BodyAnchors,
    image_w: int,
    image_h: int,
    *,
    length_mm: float | None = None,
    adjustments: Adjustments | None = None,
) -> Placement:
    strips = plan_strips(asset, anchors, length_mm=length_mm, adjustments=adjustments)
    bbox = strips_bbox(strips, asset.height, image_w, image_h)
    # The "matrix" of a strand placement is the middle strip's affine (for callers that
    # only need an approximate transform); the strips carry the real warp.
    middle = strips[len(strips) // 2].matrix
    return Placement(
        region=anchors.region,
        matrix=middle,
        bbox=bbox,
        confidence=anchors.confidence,
        occlusion=dict(anchors.occlusion),
        asset_id=asset.asset_id,
        strips=[(s.x0, s.x1, s.matrix) for s in strips],
    )
