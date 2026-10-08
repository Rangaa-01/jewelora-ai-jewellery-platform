import { applyMatrix, brightnessFor, EarringSway, PlacementHold, rotateAbout } from "./motion";
import { LandmarkSmoother } from "./smoothing";
import type { LivePlacement } from "./types";
import type { AffineMatrix } from "../fitting/types";

const IDENTITY: AffineMatrix = [
  [1, 0, 0],
  [0, 1, 0],
];

function earring(x: number, region = "left_ear"): LivePlacement {
  return {
    item: {
      product: { id: "p1" },
      geometry: { width: 20, height: 60, anchors: { top: { x: 0.5, y: 0 } } },
    } as unknown as LivePlacement["item"],
    placement: {
      region,
      matrix: [
        [1, 0, x],
        [0, 1, 100],
      ],
      bbox: [0, 0, 1, 1],
      confidence: 1,
      occlusion: {},
      asset_id: "a",
    },
  };
}

describe("live motion", () => {
  it("rotates about a fixed pivot", () => {
    const pivot = { x: 10, y: 20 };
    const m = rotateAbout(IDENTITY, pivot, 90);
    const p = applyMatrix(m, pivot);
    expect(p.x).toBeCloseTo(10, 9);
    expect(p.y).toBeCloseTo(20, 9);
    const q = applyMatrix(m, { x: 11, y: 20 });
    expect(q.x).toBeCloseTo(10, 9);
    expect(q.y).toBeCloseTo(21, 9);
  });

  it("holds a lost placement and fades it out", () => {
    const hold = new PlacementHold(600);
    expect(hold.update([earring(0)], 0)).toHaveLength(1);
    const early = hold.update([], 200);
    expect(early).toHaveLength(1);
    expect(early[0]!.opacity).toBe(1);
    expect(hold.update([], 450)[0]!.opacity).toBeCloseTo(0.5, 5);
    expect(hold.update([], 700)).toHaveLength(0);
  });

  it("swings an earring when the head moves and settles when it stops", () => {
    const sway = new EarringSway();
    const angle = (p: LivePlacement) =>
      (Math.atan2(p.placement.matrix[1][0], p.placement.matrix[0][0]) * 180) / Math.PI;
    sway.apply([earring(0)], 0, 0.5);
    // Head jerks to the right: the drop lags behind, swinging (clockwise is +).
    let last = sway.apply([earring(30)], 33, 0.5)[0]!;
    expect(Math.abs(angle(last))).toBeGreaterThan(0.5);
    expect(Math.abs(angle(last))).toBeLessThanOrEqual(12.0001);
    let t = 33;
    for (let i = 0; i < 90; i += 1) {
      t += 33;
      last = sway.apply([earring(30)], t, 0.5)[0]!;
    }
    expect(Math.abs(angle(last))).toBeLessThan(0.5);
  });

  it("dims jewellery in a dark room but never brightens it", () => {
    expect(brightnessFor(0.1)).toBe(0.7);
    expect(brightnessFor(0.9)).toBe(1);
    expect(brightnessFor(0.36)).toBeCloseTo(0.8, 5);
  });

  it("predicts ahead along the motion", () => {
    const smoother = new LandmarkSmoother();
    const lm = (x: number) => ({
      image_width: 100,
      image_height: 100,
      face: [{ x, y: 50 }],
      hands: [],
      pose: null,
      pose_visibility: null,
    });
    let out = smoother.apply(lm(0), 0, 60);
    for (let i = 1; i <= 10; i += 1) out = smoother.apply(lm(i * 10), i * 33, 60);
    const still = new LandmarkSmoother();
    let plain = still.apply(lm(0), 0);
    for (let i = 1; i <= 10; i += 1) plain = still.apply(lm(i * 10), i * 33);
    expect(out.face![0]!.x).toBeGreaterThan(plain.face![0]!.x);
  });
});
