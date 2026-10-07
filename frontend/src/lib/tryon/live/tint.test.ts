import { hexToRgb, hsvToRgb, rgbToHsv, tintPixels } from "./tint";

describe("tint", () => {
  it("round-trips RGB through HSV", () => {
    const [h, s, v] = rgbToHsv(214, 168, 74);
    const back = hsvToRgb(h, s, v);
    expect(back.map((c, i) => Math.abs(c - [214, 168, 74][i]!)).every((d) => d <= 1)).toBe(true);
  });

  it("recolours gold pixels towards the target metal and leaves gems and transparency alone", () => {
    const px = new Uint8ClampedArray([
      214,
      168,
      74,
      255, // gold
      200,
      20,
      40,
      255, // ruby
      214,
      168,
      74,
      0, // transparent gold (ignored)
    ]);
    tintPixels(px, "#d6d6dc"); // white gold
    expect(Math.abs(px[0]! - px[2]!)).toBeLessThan(40);
    expect([px[4], px[5], px[6]]).toEqual([200, 20, 40]);
    expect([px[8], px[9], px[10]]).toEqual([214, 168, 74]);
    expect(hexToRgb("#d6a84a")).toEqual([214, 168, 74]);
  });
});
