import type { JewelleryType } from "@/lib/api/types";

/** Pixel-space point. Mirrors `jewelora_ai.datatypes.Point`. */
export interface Point {
  x: number;
  y: number;
}

export interface Hand {
  /** 21 MediaPipe hand landmarks in pixels. */
  points: Point[];
  /** The person's hand: "Left" | "Right". */
  handedness: string;
  score: number;
}

/** Everything the detectors found, in pixel coordinates of the image/frame. */
export interface Landmarks {
  image_width: number;
  image_height: number;
  face: Point[] | null;
  face_score?: number;
  hands: Hand[];
  pose: Point[] | null;
  pose_visibility: number[] | null;
}

export interface BodyAnchors {
  region: string;
  points: Record<string, Point>;
  px_per_mm: number;
  rotation_deg: number;
  confidence: number;
  mirror: boolean;
  occlusion: Record<string, number>;
  /** Horizontal foreshortening about the pivot (1 = facing the camera); earrings on a turned head. */
  squash_x?: number;
}

/** Geometry of a try-on asset (the bitmap itself is handled by the renderer). */
export interface AssetGeometry {
  width: number;
  height: number;
  /** Normalised 0..1 asset coordinates. */
  anchors: Record<string, Point>;
  jewellery_type: JewelleryType;
  real_width_mm: number | null;
  real_height_mm: number | null;
  asset_id: string | null;
}

export interface Adjustments {
  offset_x: number;
  offset_y: number;
  scale: number;
  rotation_deg: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  offset_x: 0,
  offset_y: 0,
  scale: 1,
  rotation_deg: 0,
};

/** 2×3 affine matrix [[a, b, tx], [c, d, ty]] mapping asset pixels → image pixels. */
export type AffineMatrix = [[number, number, number], [number, number, number]];

/** One vertical slice of the asset (x0..x1 in asset pixels) and the affine that places it. */
export interface Strip {
  x0: number;
  x1: number;
  matrix: AffineMatrix;
}

export interface Placement {
  region: string;
  matrix: AffineMatrix;
  bbox: [number, number, number, number];
  confidence: number;
  occlusion: Record<string, number>;
  asset_id: string | null;
  /** Strand warp pieces (necklaces etc.). Empty or absent means a single rigid transform. */
  strips?: Strip[];
}

export class AnchorError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "AnchorError";
    this.code = code;
  }
}

export const point = (x: number, y: number): Point => ({ x, y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scaled = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
