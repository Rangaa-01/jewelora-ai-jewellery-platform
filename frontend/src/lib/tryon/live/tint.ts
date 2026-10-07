/**
 * Metal recolouring for variant switching, mirroring `jewelora_ai.rendering.compositor.tint_metal`.
 *
 * Pixels whose hue is close to the reference gold hue (and reasonably saturated) are
 * re-mapped to the target metal hue, with saturation/value scaled by the target/reference
 * ratio so highlights and shading survive. Gems and pearls are left alone.
 *
 * Simplification vs. the Python: the server blurs the metal mask slightly (Gaussian σ=1)
 * to soften edges; the browser version applies a hard mask, which is visually equivalent
 * at overlay sizes and keeps the one-off pre-tint cheap.
 */

export const REFERENCE_GOLD = "#d6a84a";
const HUE_TOLERANCE_DEG = 28; // OpenCV's 14 on a 0–180 hue scale
const MIN_SATURATION = 40 / 255;

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** RGB (0–255) → HSV with h in degrees [0, 360), s and v in [0, 1]. */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255),
  ];
}

/** Recolours metal pixels in place. `data` is an RGBA byte array (ImageData.data). */
export function tintPixels(
  data: Uint8ClampedArray,
  tintHex: string,
  referenceHex: string = REFERENCE_GOLD,
): void {
  const [tr, tg, tb] = hexToRgb(tintHex);
  const [rr, rg, rb] = hexToRgb(referenceHex);
  const [refH, refS, refV] = rgbToHsv(rr, rg, rb);
  const [tgtH, tgtS, tgtV] = rgbToHsv(tr, tg, tb);
  const satRatio = (tgtS + 1 / 255) / (refS + 1 / 255);
  const valRatio = (tgtV + 1 / 255) / (refV + 1 / 255);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [h, s, v] = rgbToHsv(data[i]!, data[i + 1]!, data[i + 2]!);
    let diff = Math.abs(h - refH);
    diff = Math.min(diff, 360 - diff);
    if (diff >= HUE_TOLERANCE_DEG || s <= MIN_SATURATION) continue;
    const [nr, ng, nb] = hsvToRgb(tgtH, Math.min(1, s * satRatio), Math.min(1, v * valRatio));
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}

/** Returns a canvas holding the tinted copy of `image`. Call once per asset+variant. */
export function tintImage(
  image: CanvasImageSource & { width: number; height: number },
  tintHex: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  tintPixels(imageData.data, tintHex);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
