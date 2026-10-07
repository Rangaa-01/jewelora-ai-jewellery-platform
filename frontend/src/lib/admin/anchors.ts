import type { JewelleryType } from "@/lib/api/types";

/**
 * Anchor names the try-on engine expects per jewellery type, in the order staff should
 * place them. Mirrors docs/ai-tryon.md "Try-on assets".
 */
export const ANCHOR_SPECS: Record<
  Exclude<JewelleryType, "set">,
  { required: string[]; optional: string[]; hint: string }
> = {
  necklace: {
    required: ["left_end", "right_end"],
    optional: ["bottom"],
    hint: "Click the two top ends of the strand, then optionally the lowest point.",
  },
  chain: {
    required: ["left_end", "right_end"],
    optional: ["bottom"],
    hint: "Click the two top ends of the chain, then optionally the lowest point.",
  },
  pendant: {
    required: ["left_end", "right_end"],
    optional: ["bottom"],
    hint: "Click the two top ends of the chain, then optionally the pendant's lowest point.",
  },
  haram: {
    required: ["left_end", "right_end"],
    optional: ["bottom"],
    hint: "Click the two top ends of the haram, then optionally the lowest point.",
  },
  choker: {
    required: ["left_end", "right_end"],
    optional: ["bottom"],
    hint: "Click the two top ends of the choker.",
  },
  earrings: {
    required: ["top"],
    optional: ["bottom"],
    hint: "Click the hook/stud contact point (one earring; it is mirrored for the other ear).",
  },
  ring: {
    required: ["band_left", "band_right"],
    optional: ["top"],
    hint: "Viewed from the back of the hand: click where the band meets the left and right edges of the finger, then optionally the stone.",
  },
  bangle: {
    required: ["left", "right"],
    optional: ["center"],
    hint: "Top-down view: click the outer left and right edges.",
  },
  bracelet: {
    required: ["left", "right"],
    optional: ["center"],
    hint: "Top-down view: click the outer left and right edges.",
  },
  nose_ring: {
    required: ["pivot"],
    optional: ["center"],
    hint: "Click the point that touches the nostril.",
  },
  maang_tikka: {
    required: ["top", "pendant_center"],
    optional: ["bottom"],
    hint: "Click where the chain disappears into the hair, then the centre of the pendant.",
  },
  waist_chain: {
    required: ["left_end", "right_end"],
    optional: ["bottom"],
    hint: "Click the two ends of the belt, then optionally the lowest point.",
  },
  anklet: {
    required: ["left_end", "right_end"],
    optional: ["bottom"],
    hint: "Click the two top ends of the anklet.",
  },
};

export type AnchorMap = Record<string, [number, number]>;

export interface ImageFit {
  /** Rendered image size and offset inside the canvas (letterboxed). */
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/** Fit an image of `imageW×imageH` into a `boxW×boxH` box preserving aspect ratio. */
export function fitImage(imageW: number, imageH: number, boxW: number, boxH: number): ImageFit {
  if (imageW <= 0 || imageH <= 0 || boxW <= 0 || boxH <= 0)
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  const scale = Math.min(boxW / imageW, boxH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { width, height, offsetX: (boxW - width) / 2, offsetY: (boxH - height) / 2 };
}

/** Canvas click → normalised 0..1 asset coordinates. Returns null when outside the image. */
export function canvasToNormalised(
  x: number,
  y: number,
  fit: ImageFit,
): [number, number] | null {
  if (fit.width <= 0 || fit.height <= 0) return null;
  const nx = (x - fit.offsetX) / fit.width;
  const ny = (y - fit.offsetY) / fit.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return [round6(nx), round6(ny)];
}

/** Normalised 0..1 asset coordinates → canvas pixel position. */
export function normalisedToCanvas(point: [number, number], fit: ImageFit): [number, number] {
  return [fit.offsetX + point[0] * fit.width, fit.offsetY + point[1] * fit.height];
}

export function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function missingAnchors(type: Exclude<JewelleryType, "set">, anchors: AnchorMap): string[] {
  return ANCHOR_SPECS[type].required.filter((name) => !(name in anchors));
}

/** The next anchor name to place, following required then optional order. */
export function nextAnchor(type: Exclude<JewelleryType, "set">, anchors: AnchorMap): string | null {
  const spec = ANCHOR_SPECS[type];
  return [...spec.required, ...spec.optional].find((name) => !(name in anchors)) ?? null;
}

export function anchorLabel(name: string): string {
  return name.replace(/_/g, " ");
}
