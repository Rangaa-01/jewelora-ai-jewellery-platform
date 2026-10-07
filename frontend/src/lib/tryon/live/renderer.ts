/**
 * Canvas overlay rendering and frame compositing for live try-on.
 */

import type { AffineMatrix } from "../fitting/types";
import type { LivePlacement } from "./types";

/** `ctx.setTransform(a, b, c, d, e, f)` maps x' = a·x + c·y + e, y' = b·x + d·y + f. */
export function setAffine(ctx: CanvasRenderingContext2D, m: AffineMatrix, scale = 1): void {
  ctx.setTransform(
    m[0][0] * scale,
    m[1][0] * scale,
    m[0][1] * scale,
    m[1][1] * scale,
    m[0][2] * scale,
    m[1][2] * scale,
  );
}

/** Draws every placement onto `ctx` (whose canvas is in frame pixel coordinates × `scale`). */
export function drawPlacements(
  ctx: CanvasRenderingContext2D,
  placements: LivePlacement[],
  scale = 1,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const { item, placement } of placements) {
    setAffine(ctx, placement.matrix, scale);
    ctx.drawImage(item.drawable, 0, 0, item.geometry.width, item.geometry.height);
  }
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
  // Placements are expressed in display (mirrored) coordinates, matching the drawn frame.
  for (const { item, placement } of placements) {
    setAffine(ctx, placement.matrix, 1);
    ctx.drawImage(item.drawable, 0, 0, item.geometry.width, item.geometry.height);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("capture_failed");
  return new File([blob], `live-${Date.now()}.jpg`, { type: "image/jpeg" });
}
