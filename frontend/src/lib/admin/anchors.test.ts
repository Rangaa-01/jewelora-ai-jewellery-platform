import { describe, expect, it } from "vitest";
import {
  ANCHOR_SPECS,
  canvasToNormalised,
  fitImage,
  missingAnchors,
  nextAnchor,
  normalisedToCanvas,
} from "./anchors";

describe("fitImage", () => {
  it("letterboxes a wide image inside a 4:3 box", () => {
    const fit = fitImage(1400, 1000, 640, 480);
    expect(fit.width).toBeCloseTo(640);
    expect(fit.height).toBeCloseTo(457.142857);
    expect(fit.offsetX).toBe(0);
    expect(fit.offsetY).toBeCloseTo((480 - 457.142857) / 2);
  });

  it("pillarboxes a tall image", () => {
    const fit = fitImage(500, 900, 640, 480);
    expect(fit.height).toBe(480);
    expect(fit.width).toBeCloseTo(266.6667);
    expect(fit.offsetX).toBeCloseTo((640 - 266.6667) / 2);
    expect(fit.offsetY).toBe(0);
  });

  it("is safe for degenerate sizes", () => {
    expect(fitImage(0, 0, 640, 480)).toEqual({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  });
});

describe("coordinate conversion", () => {
  const fit = fitImage(1400, 1000, 640, 480);

  it("round-trips canvas ↔ normalised coordinates", () => {
    const point = canvasToNormalised(320, 240, fit);
    expect(point).not.toBeNull();
    expect(point![0]).toBeCloseTo(0.5, 6);
    expect(point![1]).toBeCloseTo(0.5, 6);
    const back = normalisedToCanvas(point!, fit);
    expect(back[0]).toBeCloseTo(320, 5);
    expect(back[1]).toBeCloseTo(240, 5);
  });

  it("maps the image corners to 0 and 1", () => {
    expect(canvasToNormalised(fit.offsetX, fit.offsetY, fit)).toEqual([0, 0]);
    expect(canvasToNormalised(fit.offsetX + fit.width, fit.offsetY + fit.height, fit)).toEqual([1, 1]);
  });

  it("rejects clicks in the letterbox margins", () => {
    expect(canvasToNormalised(320, 2, fit)).toBeNull();
    expect(canvasToNormalised(320, 478, fit)).toBeNull();
  });
});

describe("anchor sequencing", () => {
  it("walks required anchors before optional ones", () => {
    expect(nextAnchor("necklace", {})).toBe("left_end");
    expect(nextAnchor("necklace", { left_end: [0.1, 0.1] })).toBe("right_end");
    expect(nextAnchor("necklace", { left_end: [0.1, 0.1], right_end: [0.9, 0.1] })).toBe("bottom");
    expect(nextAnchor("necklace", { left_end: [0.1, 0.1], right_end: [0.9, 0.1], bottom: [0.5, 0.9] })).toBeNull();
  });

  it("reports missing required anchors only", () => {
    expect(missingAnchors("ring", { band_left: [0, 0.5] })).toEqual(["band_right"]);
    expect(missingAnchors("ring", { band_left: [0, 0.5], band_right: [1, 0.5] })).toEqual([]);
  });

  it("covers every try-on jewellery type with at least one required anchor", () => {
    for (const spec of Object.values(ANCHOR_SPECS)) expect(spec.required.length).toBeGreaterThan(0);
  });
});
