/**
 * One-euro filter (Casiez et al. 2012) for jitter-free landmark tracking: heavy smoothing
 * when still, low latency when moving. One filter per coordinate; a `LandmarkSmoother`
 * keeps a stable set of filters per landmark array.
 */

import type { Landmarks, Point } from "../fitting/types";
import { predict } from "./motion";

export interface OneEuroOptions {
  /** Minimum cutoff frequency (Hz). Lower = smoother when still. */
  minCutoff: number;
  /** Speed coefficient. Higher = less lag when moving. */
  beta: number;
  /** Cutoff for the derivative estimate (Hz). */
  dCutoff: number;
}

export const DEFAULT_ONE_EURO: OneEuroOptions = { minCutoff: 1.2, beta: 0.02, dCutoff: 1.0 };

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private t: number | null = null;

  constructor(private readonly opts: OneEuroOptions = DEFAULT_ONE_EURO) {}

  reset(): void {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }

  /** Smoothed rate of change (units per second), for short-term prediction. */
  get velocity(): number {
    return this.dx;
  }

  /** Filter `value` sampled at `timestampMs`. */
  filter(value: number, timestampMs: number): number {
    if (this.x === null || this.t === null) {
      this.x = value;
      this.t = timestampMs;
      return value;
    }
    const dt = Math.max((timestampMs - this.t) / 1000, 1e-3);
    this.t = timestampMs;
    const rawDx = (value - this.x) / dt;
    const aD = alpha(this.opts.dCutoff, dt);
    this.dx = aD * rawDx + (1 - aD) * this.dx;
    const cutoff = this.opts.minCutoff + this.opts.beta * Math.abs(this.dx);
    const a = alpha(cutoff, dt);
    this.x = a * value + (1 - a) * this.x;
    return this.x;
  }
}

class PointArraySmoother {
  private filters: [OneEuroFilter, OneEuroFilter][] = [];

  constructor(private readonly opts: OneEuroOptions) {}

  apply(points: Point[], timestampMs: number, leadMs = 0): Point[] {
    if (this.filters.length !== points.length) {
      this.filters = points.map(() => [new OneEuroFilter(this.opts), new OneEuroFilter(this.opts)]);
    }
    return points.map((p, i) => {
      const [fx, fy] = this.filters[i]!;
      const smoothed = { x: fx.filter(p.x, timestampMs), y: fy.filter(p.y, timestampMs) };
      return leadMs > 0 ? predict(smoothed, { x: fx.velocity, y: fy.velocity }, leadMs) : smoothed;
    });
  }

  reset(): void {
    this.filters = [];
  }
}

/** Smooths face, hands (keyed by handedness) and pose landmark arrays frame to frame. */
export class LandmarkSmoother {
  private face: PointArraySmoother;
  private pose: PointArraySmoother;
  private hands = new Map<string, PointArraySmoother>();
  private missedFace = 0;

  constructor(private readonly opts: OneEuroOptions = DEFAULT_ONE_EURO) {
    this.face = new PointArraySmoother(opts);
    this.pose = new PointArraySmoother(opts);
  }

  /**
   * `leadMs`: how far the drawn frame is ahead of the detected one (detection latency). The
   * points are extrapolated along their smoothed velocity so the piece doesn't trail behind
   * a moving head or hand.
   */
  apply(lm: Landmarks, timestampMs: number, leadMs = 0): Landmarks {
    const face = lm.face ? this.face.apply(lm.face, timestampMs, leadMs) : null;
    if (!lm.face) {
      // Reset after a short absence so a reappearing face doesn't "slide in" from its old spot.
      this.missedFace += 1;
      if (this.missedFace > 10) this.face.reset();
    } else {
      this.missedFace = 0;
    }
    const pose = lm.pose ? this.pose.apply(lm.pose, timestampMs, leadMs) : null;
    const seen = new Set<string>();
    const hands = lm.hands.map((hand, index) => {
      const key = `${hand.handedness}-${index}`;
      seen.add(key);
      let smoother = this.hands.get(key);
      if (!smoother) {
        smoother = new PointArraySmoother(this.opts);
        this.hands.set(key, smoother);
      }
      return { ...hand, points: smoother.apply(hand.points, timestampMs, leadMs) };
    });
    for (const key of this.hands.keys()) if (!seen.has(key)) this.hands.delete(key);
    return { ...lm, face, pose, hands };
  }

  reset(): void {
    this.face.reset();
    this.pose.reset();
    this.hands.clear();
    this.missedFace = 0;
  }
}
