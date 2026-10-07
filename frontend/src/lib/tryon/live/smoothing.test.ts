import { LandmarkSmoother, OneEuroFilter } from "./smoothing";

describe("OneEuroFilter", () => {
  it("passes the first sample through and damps noise when still", () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 });
    expect(f.filter(100, 0)).toBe(100);
    const noisy = [102, 98, 101, 99, 103, 97];
    let last = 100;
    noisy.forEach((v, i) => {
      last = f.filter(v, (i + 1) * 40);
    });
    expect(Math.abs(last - 100)).toBeLessThan(2);
  });

  it("follows fast motion with little lag when beta is high", () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 1, dCutoff: 1 });
    f.filter(0, 0);
    let value = 0;
    for (let i = 1; i <= 10; i += 1) value = f.filter(i * 50, i * 40);
    expect(value).toBeGreaterThan(400);
  });
});

describe("LandmarkSmoother", () => {
  it("smooths face and hand arrays and tracks hands by handedness", () => {
    const s = new LandmarkSmoother({ minCutoff: 1, beta: 0, dCutoff: 1 });
    const base = {
      image_width: 100,
      image_height: 100,
      face: [{ x: 10, y: 10 }],
      hands: [{ handedness: "Left", score: 0.9, points: [{ x: 50, y: 50 }] }],
      pose: null,
      pose_visibility: null,
    };
    s.apply(base, 0);
    const next = s.apply(
      {
        ...base,
        face: [{ x: 14, y: 10 }],
        hands: [{ ...base.hands[0]!, points: [{ x: 54, y: 50 }] }],
      },
      40,
    );
    expect(next.face![0]!.x).toBeGreaterThan(10);
    expect(next.face![0]!.x).toBeLessThan(14);
    expect(next.hands[0]!.points[0]!.x).toBeGreaterThan(50);
    expect(next.hands[0]!.points[0]!.x).toBeLessThan(54);
  });

  it("returns null face when nothing is detected", () => {
    const s = new LandmarkSmoother();
    const out = s.apply(
      { image_width: 1, image_height: 1, face: null, hands: [], pose: null, pose_visibility: null },
      0,
    );
    expect(out.face).toBeNull();
  });
});
