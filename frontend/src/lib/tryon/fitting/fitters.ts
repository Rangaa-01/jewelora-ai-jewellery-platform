/**
 * Similarity-transform fitting. Port of `ai/jewelora_ai/fitting/fitters.py`.
 */

import {
  DEFAULT_ADJUSTMENTS,
  distance,
  point,
  type Adjustments,
  type AffineMatrix,
  type AssetGeometry,
  type BodyAnchors,
  type Placement,
  type Point,
} from "./types";

/** Which asset anchor pair drives each region: [asset_a, asset_b, body_a, body_b]. */
const PAIRS: Record<string, [string, string, string, string]> = {
  neck: ["left_end", "right_end", "left_end", "right_end"],
  waist: ["left_end", "right_end", "left_end", "right_end"],
  ankle: ["left_end", "right_end", "left_end", "right_end"],
  finger: ["band_left", "band_right", "band_left", "band_right"],
  wrist: ["left", "right", "left", "right"],
  forehead: ["top", "pendant_center", "top", "pendant_center"],
};

const PHYSICAL_KINDS = new Set(["neck", "waist", "ankle", "forehead"]);

function regionKind(region: string): string {
  for (const kind of ["neck", "waist", "ankle", "finger", "wrist", "forehead"]) {
    if (region.includes(kind)) return kind;
  }
  if (region.includes("ear")) return "ear";
  if (region.includes("nostril")) return "nostril";
  return region;
}

export function anchorPx(asset: AssetGeometry, name: string): Point {
  const a = asset.anchors[name]!;
  return point(a.x * asset.width, a.y * asset.height);
}

export function similarityFromPairs(
  srcA: Point,
  srcB: Point,
  dstA: Point,
  dstB: Point,
): [number, number] {
  const srcV = point(srcB.x - srcA.x, srcB.y - srcA.y);
  const dstV = point(dstB.x - dstA.x, dstB.y - dstA.y);
  const srcLen = Math.hypot(srcV.x, srcV.y) || 1.0;
  const dstLen = Math.hypot(dstV.x, dstV.y);
  const scale = dstLen / srcLen;
  const rotation = ((Math.atan2(dstV.y, dstV.x) - Math.atan2(srcV.y, srcV.x)) * 180) / Math.PI;
  return [scale, rotation];
}

function plainMatrix(
  scale: number,
  rotationDeg: number,
  pivotSrc: Point,
  pivotDst: Point,
): AffineMatrix {
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad) * scale;
  const s = Math.sin(rad) * scale;
  const tx = pivotDst.x - (c * pivotSrc.x - s * pivotSrc.y);
  const ty = pivotDst.y - (s * pivotSrc.x + c * pivotSrc.y);
  return [
    [c, -s, tx],
    [s, c, ty],
  ];
}

/** M = T(dst) · R·S · T(−mirror(pivot)) · Mirror, with Mirror: x → width − x. */
function mirrorMatrix(
  scale: number,
  rotationDeg: number,
  pivotSrc: Point,
  pivotDst: Point,
  srcWidth: number,
): AffineMatrix {
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad) * scale;
  const s = Math.sin(rad) * scale;
  const pmX = srcWidth - pivotSrc.x;
  const pmY = pivotSrc.y;
  // R·S · T(-pm) · Mirror  =  [[-c, -s, c*pm.x + s*pm.y + c*w... ]] — compose explicitly:
  // Mirror: (x, y) -> (w - x, y) ; T(-pm): -> (w - x - pmX, y - pmY) ; R·S ; T(dst)
  const a = -c;
  const b = -s;
  const d = -s;
  const e = c;
  const tx = pivotDst.x + c * (srcWidth - pmX) + s * pmY;
  const ty = pivotDst.y + s * (srcWidth - pmX) - c * pmY;
  return [
    [a, b, tx],
    [d, e, ty],
  ];
}

export function applyAffine(m: AffineMatrix, p: Point): Point {
  return point(m[0][0] * p.x + m[0][1] * p.y + m[0][2], m[1][0] * p.x + m[1][1] * p.y + m[1][2]);
}

export function transformedBbox(
  m: AffineMatrix,
  width: number,
  height: number,
  imageW: number,
  imageH: number,
): [number, number, number, number] {
  const corners = [point(0, 0), point(width, 0), point(0, height), point(width, height)].map((c) =>
    applyAffine(m, c),
  );
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return [
    Math.max(0, Math.floor(Math.min(...xs))),
    Math.max(0, Math.floor(Math.min(...ys))),
    Math.min(imageW, Math.ceil(Math.max(...xs))),
    Math.min(imageH, Math.ceil(Math.max(...ys))),
  ];
}

export function fitAsset(
  asset: AssetGeometry,
  anchors: BodyAnchors,
  imageW: number,
  imageH: number,
  adjustments: Adjustments = DEFAULT_ADJUSTMENTS,
): Placement {
  const kind = regionKind(anchors.region);
  let pivotSrc: Point;
  let pivotDst: Point;
  let scale: number;
  let rotation: number;
  const pair = PAIRS[kind];
  if (pair && pair[0] in asset.anchors && pair[1] in asset.anchors) {
    const [aSrc, bSrc, aDst, bDst] = pair;
    const srcA = anchorPx(asset, aSrc);
    const srcB = anchorPx(asset, bSrc);
    const dstA = anchors.points[aDst]!;
    const dstB = anchors.points[bDst]!;
    [scale, rotation] = similarityFromPairs(srcA, srcB, dstA, dstB);
    if (asset.real_width_mm && PHYSICAL_KINDS.has(kind)) {
      const physical = (asset.real_width_mm * anchors.px_per_mm) / asset.width;
      scale = physical * 0.5 + scale * 0.5;
    }
    pivotSrc = point((srcA.x + srcB.x) / 2, (srcA.y + srcB.y) / 2);
    pivotDst = point((dstA.x + dstB.x) / 2, (dstA.y + dstB.y) / 2);
  } else if (kind === "ear") {
    pivotSrc = "top" in asset.anchors ? anchorPx(asset, "top") : point(asset.width / 2, 0);
    pivotDst = anchors.points.top!;
    rotation = anchors.rotation_deg;
    scale = asset.real_height_mm
      ? (asset.real_height_mm * anchors.px_per_mm) / asset.height
      : (distance(anchors.points.oval!, anchors.points.top!) * 1.6) / asset.height;
  } else if (kind === "nostril") {
    pivotSrc =
      "pivot" in asset.anchors
        ? anchorPx(asset, "pivot")
        : point(asset.width * 0.25, asset.height * 0.25);
    pivotDst = anchors.points.pivot!;
    rotation = anchors.rotation_deg;
    scale = ((asset.real_width_mm || 12.0) * anchors.px_per_mm) / asset.width;
  } else {
    throw new Error(`no fitting strategy for region ${anchors.region}`);
  }

  scale *= adjustments.scale;
  rotation += adjustments.rotation_deg;
  pivotDst = point(pivotDst.x + adjustments.offset_x, pivotDst.y + adjustments.offset_y);
  let matrix = anchors.mirror
    ? mirrorMatrix(scale, rotation, pivotSrc, pivotDst, asset.width)
    : plainMatrix(scale, rotation, pivotSrc, pivotDst);
  const q = anchors.squash_x ?? 1;
  if (q !== 1) {
    matrix = [
      [matrix[0][0] * q, matrix[0][1] * q, q * matrix[0][2] + (1 - q) * pivotDst.x],
      [matrix[1][0], matrix[1][1], matrix[1][2]],
    ];
  }
  return {
    region: anchors.region,
    matrix,
    bbox: transformedBbox(matrix, asset.width, asset.height, imageW, imageH),
    confidence: anchors.confidence,
    occlusion: { ...anchors.occlusion },
    asset_id: asset.asset_id,
  };
}
