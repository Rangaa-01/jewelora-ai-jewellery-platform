/**
 * Live-mode motion helpers that make the overlay behave like a worn object:
 *
 * - `PlacementHold`: when tracking drops for a moment (a hand passes the face, motion blur),
 *   the last good placement stays and fades out instead of the piece vanishing.
 * - `EarringSway`: a damped pendulum per earring, driven by the ear's acceleration, so
 *   drops swing a little when the head moves and settle when it stops.
 * - `SceneBrightness`: the camera image's brightness, sampled a few times a second, so the
 *   jewellery dims in a dark room instead of glowing like a sticker.
 */

import type { AffineMatrix, Placement, Point } from "../fitting/types";
import type { LivePlacement } from "./types";

/** M' = T(p) · R(θ) · T(−p) · M (rotation about an image-space point). */
export function rotateAbout(matrix: AffineMatrix, pivot: Point, degrees: number): AffineMatrix {
  if (degrees === 0) return matrix;
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const [[a, b, tx], [d, e, ty]] = matrix;
  const ntx = c * (tx - pivot.x) - s * (ty - pivot.y) + pivot.x;
  const nty = s * (tx - pivot.x) + c * (ty - pivot.y) + pivot.y;
  return [
    [c * a - s * d, c * b - s * e, ntx],
    [s * a + c * d, s * b + c * e, nty],
  ];
}

export function applyMatrix(m: AffineMatrix, p: Point): Point {
  return { x: m[0][0] * p.x + m[0][1] * p.y + m[0][2], y: m[1][0] * p.x + m[1][1] * p.y + m[1][2] };
}

export interface HeldPlacement extends LivePlacement {
  /** 0..1, multiplied into the canvas alpha while a lost placement fades out. */
  opacity: number;
}

/** Keeps the last placement per item+region for `holdMs`, fading over the second half. */
export class PlacementHold {
  private last = new Map<string, { value: LivePlacement; at: number }>();

  constructor(private readonly holdMs = 600) {}

  static key(p: LivePlacement): string {
    return `${p.item.product.id}:${p.placement.region}`;
  }

  update(current: LivePlacement[], now: number): HeldPlacement[] {
    const seen = new Set<string>();
    const out: HeldPlacement[] = [];
    for (const p of current) {
      const key = PlacementHold.key(p);
      seen.add(key);
      this.last.set(key, { value: p, at: now });
      out.push({ ...p, opacity: 1 });
    }
    for (const [key, { value, at }] of this.last) {
      if (seen.has(key)) continue;
      const age = now - at;
      if (age > this.holdMs) {
        this.last.delete(key);
        continue;
      }
      const fadeStart = this.holdMs / 2;
      const opacity = age < fadeStart ? 1 : 1 - (age - fadeStart) / (this.holdMs - fadeStart);
      out.push({ ...value, opacity: Math.max(0, opacity) });
    }
    return out;
  }

  reset(): void {
    this.last.clear();
  }
}

interface PendulumState {
  angle: number; // degrees
  velocity: number; // degrees / s
  lastPivot: Point | null;
  lastPivotVelocity: number; // px / s (horizontal)
  lastT: number | null;
}

const MAX_SWAY_DEG = 12;

/** Damped pendulum per earring. Positive angle = clockwise in image space. */
export class EarringSway {
  private states = new Map<string, PendulumState>();

  /** Rotates each earring placement about its hook by its current swing angle. */
  apply(placements: LivePlacement[], now: number, pxPerMm: number): LivePlacement[] {
    return placements.map((p) => {
      if (!p.placement.region.endsWith("_ear") || p.placement.strips?.length) return p;
      const geometry = p.item.geometry;
      const hookSrc = geometry.anchors.top
        ? {
            x: geometry.anchors.top.x * geometry.width,
            y: geometry.anchors.top.y * geometry.height,
          }
        : { x: geometry.width / 2, y: 0 };
      const pivot = applyMatrix(p.placement.matrix, hookSrc);
      const bottom = applyMatrix(p.placement.matrix, { x: hookSrc.x, y: geometry.height });
      const lengthPx = Math.max(8, Math.hypot(bottom.x - pivot.x, bottom.y - pivot.y));
      const angle = this.step(PlacementHold.key(p), pivot, lengthPx, now, pxPerMm);
      if (Math.abs(angle) < 0.05) return p;
      return {
        ...p,
        placement: { ...p.placement, matrix: rotateAbout(p.placement.matrix, pivot, angle) },
      };
    });
  }

  private step(key: string, pivot: Point, lengthPx: number, now: number, pxPerMm: number): number {
    let s = this.states.get(key);
    if (!s) {
      s = { angle: 0, velocity: 0, lastPivot: pivot, lastPivotVelocity: 0, lastT: now };
      this.states.set(key, s);
      return 0;
    }
    const dt = Math.min(0.1, Math.max(0.001, (now - (s.lastT ?? now)) / 1000));
    const vx = s.lastPivot ? (pivot.x - s.lastPivot.x) / dt : 0;
    const ax = (vx - s.lastPivotVelocity) / dt;
    // g in px/s² at the wearer's scale; a dangling drop of length L.
    const g = 9810 * Math.max(pxPerMm, 0.05);
    const theta = (s.angle * Math.PI) / 180;
    const accel = -(g / lengthPx) * Math.sin(theta) - (ax / lengthPx) * Math.cos(theta);
    const damping = 6; // 1/s — settles within ~half a second, like a light drop
    let omega = (s.velocity * Math.PI) / 180;
    omega += (accel - damping * omega) * dt;
    let next = theta + omega * dt;
    const max = (MAX_SWAY_DEG * Math.PI) / 180;
    if (Math.abs(next) > max) {
      next = Math.sign(next) * max;
      omega *= 0.3;
    }
    s.angle = (next * 180) / Math.PI;
    s.velocity = (omega * 180) / Math.PI;
    s.lastPivot = pivot;
    s.lastPivotVelocity = vx;
    s.lastT = now;
    return s.angle;
  }

  reset(): void {
    this.states.clear();
  }
}

/** Average brightness of the camera frame's centre, sampled every `intervalMs`. */
export class SceneBrightness {
  private canvas: HTMLCanvasElement | null = null;
  private value = 1;
  private lastAt = -Infinity;

  constructor(private readonly intervalMs = 400) {}

  /** CSS `brightness()` factor for the jewellery: 0.7 (dark room) .. 1.0 (well lit). */
  sample(video: HTMLVideoElement, now: number): number {
    if (now - this.lastAt < this.intervalMs) return this.value;
    this.lastAt = now;
    if (typeof document === "undefined") return this.value;
    this.canvas ??= document.createElement("canvas");
    const size = 24;
    this.canvas.width = size;
    this.canvas.height = size;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !video.videoWidth) return this.value;
    const w = video.videoWidth;
    const h = video.videoHeight;
    ctx.drawImage(video, w * 0.25, h * 0.15, w * 0.5, h * 0.7, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    }
    const luma = sum / (size * size * 255);
    const target = brightnessFor(luma);
    // Ease towards the new value so lighting changes don't flicker.
    this.value += (target - this.value) * 0.35;
    return this.value;
  }
}

export function brightnessFor(luma: number): number {
  return Math.min(1, Math.max(0.7, luma / 0.45));
}

/** Short-term motion prediction: where a point will be `leadMs` from now. */
export function predict(p: Point, velocity: Point, leadMs: number): Point {
  const lead = Math.min(Math.max(leadMs, 0), 80) / 1000;
  return { x: p.x + velocity.x * lead * 0.7, y: p.y + velocity.y * lead * 0.7 };
}

export type { Placement };
