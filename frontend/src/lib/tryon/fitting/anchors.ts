/**
 * Derive jewellery placement anchors from detected landmarks.
 *
 * This is a line-for-line port of `ai/jewelora_ai/fitting/anchors.py` (the source of
 * truth). Constants, landmark indices and formulas must stay identical; the Vitest parity
 * test compares both implementations on recorded landmarks.
 *
 * Regions are named by IMAGE side ("left_ear" = image-left), never by the person's side.
 */

import type { JewelleryType } from "@/lib/api/types";
import {
  AnchorError,
  add,
  distance,
  lerp,
  midpoint,
  point,
  scaled,
  sub,
  type BodyAnchors,
  type Hand,
  type Landmarks,
  type Point,
} from "./types";

export const AVG_INTER_EYE_OUTER_MM = 90.0;
export const AVG_PALM_WIDTH_MM = 76.0;
export const AVG_SHOULDER_WIDTH_MM = 380.0;

export type Finger = "index" | "middle" | "ring" | "pinky";
export const FINGER_SLOTS: Record<Finger, [number, number, number]> = {
  index: [5, 6, 9],
  middle: [9, 10, 13],
  ring: [13, 14, 17],
  pinky: [17, 18, 13],
};

const NECK_TYPES: ReadonlySet<JewelleryType> = new Set([
  "necklace",
  "chain",
  "pendant",
  "haram",
  "choker",
]);

function angleDeg(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Unit vector perpendicular to v (rotated -90°). */
function perp(v: Point): Point {
  const n = Math.hypot(v.x, v.y) || 1.0;
  return point(-v.y / n, v.x / n);
}

function unit(v: Point): Point {
  const n = Math.hypot(v.x, v.y) || 1.0;
  return point(v.x / n, v.y / n);
}

function requireFace(lm: Landmarks): Point[] {
  if (!lm.face) throw new AnchorError("no_face");
  return lm.face;
}

// --- face based ---------------------------------------------------------------------------

export function faceYawRatio(lm: Landmarks): number {
  const face = requireFace(lm);
  const nose = face[1]!;
  const left = face[234]!;
  const right = face[454]!;
  const width = right.x - left.x || 1.0;
  return ((nose.x - left.x) / width - 0.5) * 2;
}

/** [px_per_mm, head roll in degrees] from the outer eye corners, corrected for yaw. */
export function faceScale(lm: Landmarks): [number, number] {
  const face = requireFace(lm);
  const leftEye = face[33]!;
  const rightEye = face[263]!;
  const dist = distance(leftEye, rightEye);
  if (dist < 8) throw new AnchorError("face_too_small");
  const yaw = Math.abs(faceYawRatio(lm));
  const foreshortening = Math.max(0.55, Math.sqrt(Math.max(0.0, 1.0 - (0.8 * yaw) ** 2)));
  return [dist / foreshortening / AVG_INTER_EYE_OUTER_MM, angleDeg(leftEye, rightEye)];
}

export function earringAnchors(lm: Landmarks): BodyAnchors[] {
  const face = requireFace(lm);
  const [pxPerMm] = faceScale(lm);
  const yaw = faceYawRatio(lm);
  const faceW = distance(face[234]!, face[454]!);
  const out: BodyAnchors[] = [];
  const sides: Array<[number, number, string, boolean, number]> = [
    [177, 234, "left_ear", false, 1.0 + Math.min(0.0, yaw) * 2.0],
    [401, 454, "right_ear", true, 1.0 - Math.max(0.0, yaw) * 2.0],
  ];
  for (const [lobeIdx, ovalIdx, region, mirror, vis] of sides) {
    if (vis < 0.3) continue;
    const lobe = face[lobeIdx]!;
    const oval = face[ovalIdx]!;
    const outward = region === "left_ear" ? -1.0 : 1.0;
    const hang = point(
      lobe.x + outward * faceW * (0.03 + 0.2 * Math.abs(yaw)),
      lobe.y + faceW * 0.02,
    );
    out.push({
      region,
      points: { top: hang, oval },
      px_per_mm: pxPerMm,
      rotation_deg: 0, // earrings hang with gravity, whatever the head tilt
      confidence: Math.max(0.3, Math.min(1.0, vis)),
      mirror,
      occlusion: { hair: 0.55 },
      squash_x: Math.max(0.6, Math.sqrt(Math.max(0.0, 1.0 - (0.8 * yaw) ** 2))),
    });
  }
  if (out.length === 0) throw new AnchorError("ears_not_visible");
  return out;
}

export function noseRingAnchors(lm: Landmarks, side: "left" | "right" = "left"): BodyAnchors {
  const face = requireFace(lm);
  const [pxPerMm, roll] = faceScale(lm);
  const nostril = face[side === "left" ? 98 : 327]!;
  return {
    region: `${side}_nostril`,
    points: { pivot: nostril },
    px_per_mm: pxPerMm,
    rotation_deg: roll,
    confidence: 0.9,
    mirror: side === "right",
    occlusion: {},
  };
}

export function maangTikkaAnchors(lm: Landmarks): BodyAnchors {
  const face = requireFace(lm);
  const [pxPerMm, roll] = faceScale(lm);
  const hairline = face[10]!;
  const forehead = face[151]!;
  const browMid = face[9]!;
  const pendant = lerp(forehead, browMid, 0.25);
  const top = lerp(hairline, forehead, -0.55);
  return {
    region: "forehead",
    points: { top, pendant_center: pendant, bottom: lerp(pendant, browMid, 0.6) },
    px_per_mm: pxPerMm,
    rotation_deg: roll + 90.0,
    confidence: 0.85,
    mirror: false,
    occlusion: { hair: 0.45 },
  };
}

// --- neck based ---------------------------------------------------------------------------

function shouldersPlausible(lm: Landmarks, chin: Point, faceW: number): boolean {
  if (!lm.pose || !lm.pose_visibility) return false;
  if (Math.min(lm.pose_visibility[11]!, lm.pose_visibility[12]!) < 0.5) return false;
  const lSh = lm.pose[11]!;
  const rSh = lm.pose[12]!;
  for (const p of [lSh, rSh]) {
    if (!(0 <= p.x && p.x <= lm.image_width && 0 <= p.y && p.y <= lm.image_height)) return false;
  }
  const mid = midpoint(lSh, rSh);
  const width = distance(lSh, rSh);
  return mid.y > chin.y + faceW * 0.15 && 1.3 * faceW <= width && width <= 5.0 * faceW;
}

export function neckAnchors(lm: Landmarks): BodyAnchors {
  const face = requireFace(lm);
  const chin = face[152]!;
  let [pxPerMm, roll] = faceScale(lm);
  const faceW = distance(face[234]!, face[454]!);
  let confidence: number;
  let neckBase: Point;
  let halfW: number;
  if (shouldersPlausible(lm, chin, faceW)) {
    const lSh = lm.pose![11]!;
    const rSh = lm.pose![12]!;
    const shoulderMid = midpoint(lSh, rSh);
    const shoulderW = distance(lSh, rSh);
    roll = angleDeg(rSh, lSh);
    neckBase = lerp(chin, shoulderMid, 0.66);
    halfW = shoulderW * 0.23;
    pxPerMm = (pxPerMm + shoulderW / AVG_SHOULDER_WIDTH_MM) / 2;
    confidence = 0.9;
  } else {
    neckBase = point(chin.x, chin.y + faceW * 0.55);
    halfW = faceW * 0.5;
    confidence = 0.55;
  }
  const rad = (roll * Math.PI) / 180;
  const along = point(Math.cos(rad), Math.sin(rad));
  const leftEnd = point(neckBase.x - along.x * halfW, neckBase.y - along.y * halfW);
  const rightEnd = point(neckBase.x + along.x * halfW, neckBase.y + along.y * halfW);
  return {
    region: "neck",
    points: { left_end: leftEnd, right_end: rightEnd, center: neckBase },
    px_per_mm: pxPerMm,
    rotation_deg: roll,
    confidence,
    mirror: false,
    occlusion: { hair: 0.8 },
  };
}

// --- hand based ---------------------------------------------------------------------------

export function handScale(hand: Hand): number {
  const palm = distance(hand.points[5]!, hand.points[17]!);
  if (palm < 10) throw new AnchorError("hand_too_small");
  return palm / AVG_PALM_WIDTH_MM;
}

export function fingerWidthPx(hand: Hand, finger: Finger): number {
  const pts = hand.points;
  if (finger === "ring")
    return ((distance(pts[9]!, pts[13]!) + distance(pts[13]!, pts[17]!)) / 2) * 0.92;
  if (finger === "middle")
    return ((distance(pts[5]!, pts[9]!) + distance(pts[9]!, pts[13]!)) / 2) * 0.95;
  if (finger === "index") return distance(pts[5]!, pts[9]!) * 0.95;
  return distance(pts[13]!, pts[17]!) * 0.8;
}

export function ringAnchors(hand: Hand, finger: Finger = "ring"): BodyAnchors {
  const [mcpIdx, pipIdx] = FINGER_SLOTS[finger];
  const mcp = hand.points[mcpIdx]!;
  const pip = hand.points[pipIdx]!;
  if (distance(mcp, pip) < 6) throw new AnchorError("finger_not_visible");
  const direction = unit(sub(pip, mcp));
  const centre = lerp(mcp, pip, 0.38);
  const width = fingerWidthPx(hand, finger);
  const side = scaled(perp(direction), width / 2);
  const bandLeft = sub(centre, side);
  const bandRight = add(centre, side);
  return {
    region: `${hand.handedness.toLowerCase()}_${finger}_finger`,
    points: { band_left: bandLeft, band_right: bandRight, center: centre },
    px_per_mm: handScale(hand),
    rotation_deg: angleDeg(bandLeft, bandRight),
    confidence: Math.max(0.4, hand.score),
    mirror: false,
    occlusion: {},
  };
}

export function wristAnchors(hand: Hand): BodyAnchors {
  const wrist = hand.points[0]!;
  const middleMcp = hand.points[9]!;
  const palmW = distance(hand.points[5]!, hand.points[17]!);
  const direction = unit(sub(wrist, middleMcp));
  const centre = add(wrist, scaled(direction, palmW * 0.22));
  const half = palmW * 0.46;
  const side = scaled(perp(direction), half);
  const left = sub(centre, side);
  const right = add(centre, side);
  return {
    region: `${hand.handedness.toLowerCase()}_wrist`,
    points: { left, right, center: centre },
    px_per_mm: handScale(hand),
    rotation_deg: angleDeg(left, right),
    confidence: Math.max(0.4, hand.score),
    mirror: false,
    occlusion: {},
  };
}

// --- pose based ---------------------------------------------------------------------------

function poseVisible(lm: Landmarks, indices: number[], threshold = 0.5): boolean {
  if (!lm.pose || !lm.pose_visibility) return false;
  return indices.every((i) => lm.pose_visibility![i]! > threshold);
}

export function waistAnchors(lm: Landmarks): BodyAnchors {
  if (!poseVisible(lm, [23, 24, 11, 12])) throw new AnchorError("hips_not_visible");
  const pose = lm.pose!;
  const lHip = pose[23]!;
  const rHip = pose[24]!;
  const shoulderW = distance(pose[11]!, pose[12]!);
  const hipW = distance(lHip, rHip);
  const mid = midpoint(lHip, rHip);
  const torso = midpoint(pose[11]!, pose[12]!);
  const waist = lerp(mid, torso, 0.12);
  const roll = angleDeg(rHip, lHip);
  const rad = (roll * Math.PI) / 180;
  const half = hipW * 0.7;
  const along = point(Math.cos(rad), Math.sin(rad));
  return {
    region: "waist",
    points: {
      left_end: point(waist.x - along.x * half, waist.y - along.y * half),
      right_end: point(waist.x + along.x * half, waist.y + along.y * half),
      center: waist,
    },
    px_per_mm: shoulderW / AVG_SHOULDER_WIDTH_MM,
    rotation_deg: roll,
    confidence: 0.7,
    mirror: false,
    occlusion: { hair: 0.6 },
  };
}

export function ankletAnchors(lm: Landmarks, side: "left" | "right" = "left"): BodyAnchors {
  const [ankleIdx, kneeIdx] = side === "left" ? [27, 25] : [28, 26];
  if (!poseVisible(lm, [ankleIdx, kneeIdx])) throw new AnchorError("ankle_not_visible");
  const pose = lm.pose!;
  const ankle = pose[ankleIdx]!;
  const knee = pose[kneeIdx]!;
  const shin = distance(ankle, knee);
  const direction = unit(sub(ankle, knee));
  const centre = sub(ankle, scaled(direction, shin * 0.06));
  const half = shin * 0.11;
  const sideV = scaled(perp(direction), half);
  const shoulderW = poseVisible(lm, [11, 12]) ? distance(pose[11]!, pose[12]!) : shin * 1.1;
  const leftEnd = sub(centre, sideV);
  const rightEnd = add(centre, sideV);
  return {
    region: `${side}_ankle`,
    points: { left_end: leftEnd, right_end: rightEnd, center: centre },
    px_per_mm: shoulderW / AVG_SHOULDER_WIDTH_MM,
    rotation_deg: angleDeg(leftEnd, rightEnd),
    confidence: 0.65,
    mirror: false,
    occlusion: {},
  };
}

// --- dispatcher ---------------------------------------------------------------------------

export function pickHand(lm: Landmarks, slot: string | null | undefined): Hand {
  if (lm.hands.length === 0) throw new AnchorError("no_hand");
  if (slot) {
    for (const hand of lm.hands) {
      if (slot.startsWith(hand.handedness.toLowerCase())) return hand;
    }
  }
  return lm.hands.reduce((best, h) => (h.score > best.score ? h : best), lm.hands[0]!);
}

function isFinger(value: string): value is Finger {
  return value in FINGER_SLOTS;
}

/** All placements for one item (earrings produce up to two). */
export function anchorsFor(
  lm: Landmarks,
  jewelleryType: JewelleryType,
  slot: string | null = null,
): BodyAnchors[] {
  if (NECK_TYPES.has(jewelleryType)) return [neckAnchors(lm)];
  switch (jewelleryType) {
    case "earrings":
      return earringAnchors(lm);
    case "nose_ring":
      return [noseRingAnchors(lm, slot === "right_nostril" ? "right" : "left")];
    case "maang_tikka":
      return [maangTikkaAnchors(lm)];
    case "ring": {
      let finger: Finger = "ring";
      if (slot) {
        const last = slot.split("_").at(-1) ?? "ring";
        finger = isFinger(last) ? last : "ring";
      }
      return [ringAnchors(pickHand(lm, slot), finger)];
    }
    case "bangle":
    case "bracelet":
      return [wristAnchors(pickHand(lm, slot))];
    case "waist_chain":
      return [waistAnchors(lm)];
    case "anklet":
      return [ankletAnchors(lm, slot === "right_ankle" ? "right" : "left")];
    default:
      throw new AnchorError(`unsupported_type:${jewelleryType}`);
  }
}

/** Which detectors a set of jewellery types needs. */
export function detectorsNeeded(types: JewelleryType[]): {
  face: boolean;
  hands: boolean;
  pose: boolean;
} {
  const face = types.some(
    (t) => NECK_TYPES.has(t) || t === "earrings" || t === "nose_ring" || t === "maang_tikka",
  );
  const hands = types.some((t) => t === "ring" || t === "bangle" || t === "bracelet");
  const pose = types.some((t) => NECK_TYPES.has(t) || t === "waist_chain" || t === "anklet");
  return { face, hands, pose };
}
