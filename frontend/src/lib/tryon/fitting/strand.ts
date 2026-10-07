/**
 * Strand warp for neck pieces — TypeScript port of `ai/jewelora_ai/fitting/strand.py`.
 *
 * The asset is split into vertical strips along its own strand arc (a parabola through
 * its `left_end`, `bottom` and `right_end` anchors) and each strip is placed on the target
 * arc (neck-base chord, hang depth from the asset itself, scaled by the chosen length).
 * Keep the maths identical to the Python module; `parity.test.ts` checks it.
 */

import type { JewelleryType } from "@/lib/api/types";
import { anchorPx } from "./fitters";
import {
  DEFAULT_ADJUSTMENTS,
  type Adjustments,
  type AffineMatrix,
  type AssetGeometry,
  type BodyAnchors,
  type Placement,
  type Point,
  type Strip,
  distance,
  point,
} from "./types";

export const STRIPS = 28;
export const STRAND_TYPES: ReadonlySet<JewelleryType> = new Set<JewelleryType>([
  "necklace",
  "chain",
  "pendant",
  "haram",
  "choker",
  "waist_chain",
  "anklet",
]);
export const DEFAULT_LENGTH_MM: Partial<Record<JewelleryType, number>> = {
  choker: 380,
  necklace: 457,
  chain: 508,
  pendant: 457,
  haram: 711,
  waist_chain: 820,
  anklet: 254,
};

export function isStrand(asset: AssetGeometry): boolean {
  return (
    STRAND_TYPES.has(asset.jewellery_type) &&
    "left_end" in asset.anchors &&
    "right_end" in asset.anchors
  );
}

/** Coefficients of y = p·x² + q·x + r through three points (Cramer's rule, like numpy.solve). */
export function parabola(a: Point, b: Point, c: Point): [number, number, number] {
  const det = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    x3: number,
    y3: number,
    z3: number,
  ) => x1 * (y2 * z3 - z2 * y3) - y1 * (x2 * z3 - z2 * x3) + z1 * (x2 * y3 - y2 * x3);
  const d = det(a.x * a.x, a.x, 1, b.x * b.x, b.x, 1, c.x * c.x, c.x, 1);
  if (Math.abs(d) < 1e-12) return [0, 0, (a.y + b.y + c.y) / 3];
  const p = det(a.y, a.x, 1, b.y, b.x, 1, c.y, c.x, 1) / d;
  const q = det(a.x * a.x, a.y, 1, b.x * b.x, b.y, 1, c.x * c.x, c.y, 1) / d;
  const r = det(a.x * a.x, a.x, a.y, b.x * b.x, b.x, b.y, c.x * c.x, c.x, c.y) / d;
  return [p, q, r];
}

function sourceArc(asset: AssetGeometry): [Point, Point, Point] {
  const left = anchorPx(asset, "left_end");
  const right = anchorPx(asset, "right_end");
  const bottom =
    "bottom" in asset.anchors
      ? anchorPx(asset, "bottom")
      : point((left.x + right.x) / 2, asset.height * 0.95);
  return [left, bottom, right];
}

export function targetArc(
  asset: AssetGeometry,
  anchors: BodyAnchors,
  lengthMm: number | null,
): [Point, Point, Point] {
  const bodyLeft = anchors.points["left_end"]!;
  const bodyRight = anchors.points["right_end"]!;
  const mid = point((bodyLeft.x + bodyRight.x) / 2, (bodyLeft.y + bodyRight.y) / 2);
  const rad = (anchors.rotation_deg * Math.PI) / 180;
  const along = point(Math.cos(rad), Math.sin(rad));
  const down = point(-along.y, along.x);
  const [sLeft, sBottom, sRight] = sourceArc(asset);
  const chordPx = distance(bodyLeft, bodyRight);
  const srcChord = distance(sLeft, sRight) || 1;
  const srcDepth = sBottom.y - (sLeft.y + sRight.y) / 2;
  const scale = chordPx / srcChord;
  let dropPx = Math.max(srcDepth, srcChord * 0.12) * scale;
  const defaultLen = DEFAULT_LENGTH_MM[asset.jewellery_type] ?? 457;
  if (lengthMm && defaultLen) dropPx *= Math.min(Math.max(lengthMm / defaultLen, 0.6), 1.8);
  const half = chordPx / 2;
  return [
    point(mid.x - along.x * half, mid.y - along.y * half),
    point(mid.x + down.x * dropPx, mid.y + down.y * dropPx),
    point(mid.x + along.x * half, mid.y + along.y * half),
  ];
}

function frameTangent(p: number, q: number, x: number): Point {
  const slope = 2 * p * x + q;
  const n = Math.hypot(1, slope);
  return point(1 / n, slope / n);
}

export function planStrips(
  asset: AssetGeometry,
  anchors: BodyAnchors,
  lengthMm: number | null = null,
  adjustments: Adjustments = DEFAULT_ADJUSTMENTS,
  strips: number = STRIPS,
): Strip[] {
  const [sLeft, sBottom, sRight] = sourceArc(asset);
  let [tLeft, tBottom, tRight] = targetArc(asset, anchors, lengthMm);
  if (
    adjustments.offset_x ||
    adjustments.offset_y ||
    adjustments.scale !== 1 ||
    adjustments.rotation_deg
  ) {
    const mid = point((tLeft.x + tRight.x) / 2, (tLeft.y + tRight.y) / 2);
    const rad = (adjustments.rotation_deg * Math.PI) / 180;
    const c = Math.cos(rad) * adjustments.scale;
    const s = Math.sin(rad) * adjustments.scale;
    const adj = (p: Point): Point => {
      const dx = p.x - mid.x;
      const dy = p.y - mid.y;
      return point(
        mid.x + c * dx - s * dy + adjustments.offset_x,
        mid.y + s * dx + c * dy + adjustments.offset_y,
      );
    };
    [tLeft, tBottom, tRight] = [adj(tLeft), adj(tBottom), adj(tRight)];
  }
  const [sp, sq, sr] = parabola(sLeft, sBottom, sRight);
  const tMid = point((tLeft.x + tRight.x) / 2, (tLeft.y + tRight.y) / 2);
  const rad = Math.atan2(tRight.y - tLeft.y, tRight.x - tLeft.x);
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const toLocal = (p: Point): Point => {
    const dx = p.x - tMid.x;
    const dy = p.y - tMid.y;
    return point(cosR * dx + sinR * dy, -sinR * dx + cosR * dy);
  };
  const toImage = (p: Point): Point =>
    point(tMid.x + cosR * p.x - sinR * p.y, tMid.y + sinR * p.x + cosR * p.y);
  const tl = toLocal(tLeft);
  const tb = toLocal(tBottom);
  const tr = toLocal(tRight);
  const [tp, tq, trr] = parabola(tl, tb, tr);
  const srcSpan = sRight.x - sLeft.x || 1;
  const tgtSpan = tr.x - tl.x;
  const scaleAlong = tgtSpan / srcSpan;
  const scaleNormal = scaleAlong;
  const out: Strip[] = [];
  for (let i = 0; i < strips; i += 1) {
    const x0 = (asset.width * i) / strips;
    const x1 = (asset.width * (i + 1)) / strips;
    const xm = (x0 + x1) / 2;
    const sy = sp * xm * xm + sq * xm + sr;
    const sTan = frameTangent(sp, sq, xm);
    const u = (xm - sLeft.x) / srcSpan;
    const txl = tl.x + u * tgtSpan;
    const tyl = tp * txl * txl + tq * txl + trr;
    const tTanLocal = frameTangent(tp, tq, txl);
    const tPoint = toImage(point(txl, tyl));
    const tTan = point(
      cosR * tTanLocal.x - sinR * tTanLocal.y,
      sinR * tTanLocal.x + cosR * tTanLocal.y,
    );
    const srcAngle = Math.atan2(sTan.y, sTan.x);
    const tgtAngle = Math.atan2(tTan.y, tTan.x);
    const ca = Math.cos(-srcAngle);
    const sa = Math.sin(-srcAngle);
    const cb = Math.cos(tgtAngle);
    const sb = Math.sin(tgtAngle);
    // lin = R(tgt) · S(along, normal) · R(-src)
    const r00 = cb * scaleAlong * ca + -sb * scaleNormal * sa;
    const r01 = cb * scaleAlong * -sa + -sb * scaleNormal * ca;
    const r10 = sb * scaleAlong * ca + cb * scaleNormal * sa;
    const r11 = sb * scaleAlong * -sa + cb * scaleNormal * ca;
    const tx = tPoint.x - (r00 * xm + r01 * sy);
    const ty = tPoint.y - (r10 * xm + r11 * sy);
    const matrix: AffineMatrix = [
      [r00, r01, tx],
      [r10, r11, ty],
    ];
    out.push({ x0: Math.round(x0), x1: Math.round(x1), matrix });
  }
  return out;
}

export function stripsBbox(
  strips: Strip[],
  height: number,
  imageW: number,
  imageH: number,
): [number, number, number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const strip of strips) {
    for (const [x, y] of [
      [strip.x0, 0],
      [strip.x1, 0],
      [strip.x0, height],
      [strip.x1, height],
    ] as const) {
      const m = strip.matrix;
      xs.push(m[0][0] * x + m[0][1] * y + m[0][2]);
      ys.push(m[1][0] * x + m[1][1] * y + m[1][2]);
    }
  }
  return [
    Math.max(0, Math.floor(Math.min(...xs))),
    Math.max(0, Math.floor(Math.min(...ys))),
    Math.min(imageW, Math.ceil(Math.max(...xs))),
    Math.min(imageH, Math.ceil(Math.max(...ys))),
  ];
}

/** Per-column y above which pixels belong to the back of the loop (not worn in front). */
export function chordClipRow(asset: AssetGeometry): Float64Array {
  const left = anchorPx(asset, "left_end");
  const right = anchorPx(asset, "right_end");
  const rows = new Float64Array(asset.width);
  const slope = right.x === left.x ? 0 : (right.y - left.y) / (right.x - left.x);
  for (let x = 0; x < asset.width; x += 1) {
    rows[x] =
      right.x === left.x
        ? Math.min(left.y, right.y)
        : left.y + slope * (x - left.x) - asset.height * 0.02;
  }
  return rows;
}

export function strandPlacement(
  asset: AssetGeometry,
  anchors: BodyAnchors,
  imageW: number,
  imageH: number,
  lengthMm: number | null = null,
  adjustments: Adjustments = DEFAULT_ADJUSTMENTS,
): Placement {
  const strips = planStrips(asset, anchors, lengthMm, adjustments);
  const middle = strips[Math.floor(strips.length / 2)]!.matrix;
  return {
    region: anchors.region,
    matrix: middle,
    bbox: stripsBbox(strips, asset.height, imageW, imageH),
    confidence: anchors.confidence,
    occlusion: { ...anchors.occlusion },
    asset_id: asset.asset_id,
    strips,
  };
}
