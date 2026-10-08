/**
 * Canvas overlay rendering and frame compositing for live try-on.
 */

import { chordClipRow } from "../fitting/strand";
import type { AffineMatrix, AssetGeometry } from "../fitting/types";
import type { LivePlacement } from "./types";

const STRIP_OVERLAP = 2;
const clippedCache = new WeakMap<object, HTMLCanvasElement>();

/**
 * For strand pieces, pixels above the chord between the top ends are the back of the loop
 * and must not be drawn in front of the neck. Computed once per drawable.
 */
function clippedDrawable(drawable: CanvasImageSource, geometry: AssetGeometry): CanvasImageSource {
  const cached = clippedCache.get(drawable as object);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = geometry.width;
  canvas.height = geometry.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return drawable;
  ctx.drawImage(drawable, 0, 0, geometry.width, geometry.height);
  const rows = chordClipRow(geometry);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x < geometry.width; x += 1) ctx.lineTo(x, rows[x] ?? 0);
  ctx.lineTo(geometry.width, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  clippedCache.set(drawable as object, canvas);
  return canvas;
}

/** How frame-space placements land on the canvas: scaled, and mirrored for the selfie view. */
export interface Viewport {
  scale: number;
  /** CSS brightness() factor matching the room's light (1 = as photographed). */
  brightness?: number;
  /** Mirror horizontally across the canvas (x' = width − x), like the CSS-mirrored preview. */
  mirrored: boolean;
}

const PLAIN: Viewport = { scale: 1, mirrored: false };

function viewport(view: Viewport | number): Viewport {
  return typeof view === "number" ? { scale: view, mirrored: false } : view;
}

/** Draws one placement: a rigid transform, or strip by strip for strand warps. */
function drawPlacement(
  ctx: CanvasRenderingContext2D,
  live: LivePlacement & { opacity?: number },
  view: Viewport,
): void {
  const { item, placement } = live;
  const { width, height } = item.geometry;
  ctx.globalAlpha = live.opacity ?? 1;
  if (placement.strips && placement.strips.length > 0) {
    const source = clippedDrawable(item.drawable, item.geometry);
    for (const strip of placement.strips) {
      const xa = Math.max(0, strip.x0 - STRIP_OVERLAP);
      const xb = Math.min(width, strip.x1 + STRIP_OVERLAP);
      if (xb <= xa) continue;
      setAffine(ctx, strip.matrix, view);
      ctx.drawImage(source, xa, 0, xb - xa, height, xa, 0, xb - xa, height);
    }
    return;
  }
  setAffine(ctx, placement.matrix, view);
  ctx.drawImage(item.drawable, 0, 0, width, height);
}

/**
 * `ctx.setTransform(a, b, c, d, e, f)` maps x' = a·x + c·y + e, y' = b·x + d·y + f.
 * With `mirrored`, the result is reflected across the canvas: x' = canvas.width − x'.
 */
export function setAffine(
  ctx: CanvasRenderingContext2D,
  m: AffineMatrix,
  view: Viewport | number = PLAIN,
): void {
  const { scale, mirrored } = viewport(view);
  const sx = mirrored ? -1 : 1;
  ctx.setTransform(
    sx * m[0][0] * scale,
    m[1][0] * scale,
    sx * m[0][1] * scale,
    m[1][1] * scale,
    mirrored ? ctx.canvas.width - m[0][2] * scale : m[0][2] * scale,
    m[1][2] * scale,
  );
}

/** Draws every placement onto `ctx` (whose canvas is in frame pixel coordinates × `scale`). */
export function drawPlacements(
  ctx: CanvasRenderingContext2D,
  placements: LivePlacement[],
  view: Viewport | number = PLAIN,
): void {
  const v = viewport(view);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.filter =
    v.brightness && v.brightness < 0.995 ? `brightness(${v.brightness.toFixed(3)})` : "none";
  for (const placement of placements) drawPlacement(ctx, placement, v);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Composites the current video frame (optionally mirrored) and the overlay into a JPEG File
 * at the frame's native resolution.
 */
export async function captureFrame(
  video: HTMLVideoElement,
  placements: LivePlacement[],
  mirrored: boolean,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  if (mirrored) {
    ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
  }
  ctx.drawImage(video, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Placements are in raw-frame coordinates; mirror them exactly like the frame above.
  for (const placement of placements) drawPlacement(ctx, placement, { scale: 1, mirrored });
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("capture_failed");
  return new File([blob], `live-${Date.now()}.jpg`, { type: "image/jpeg" });
}
