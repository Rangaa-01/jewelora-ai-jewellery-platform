/**
 * Shared try-on session types and pure helpers (payload building, slot options).
 */

import type { JewelleryType, ProductDetail, ProductSummary } from "@/lib/api/types";
import { DEFAULT_ADJUSTMENTS, type Adjustments } from "./fitting/types";

export interface TryOnItemIn {
  product_id: string;
  variant_id: string | null;
  size_id: string | null;
  slot: string | null;
  adjustments: Adjustments;
}

export interface PlacementOut {
  region: string;
  matrix: number[][];
  bbox: number[];
  confidence: number;
  asset_id: string | null;
  product_id: string | null;
}

export interface DetectionSummary {
  image?: { width: number; height: number };
  face?: boolean;
  hands?: { handedness: string; score: number }[];
  pose?: boolean;
}

export interface RingSizeEstimate {
  finger: string;
  handedness: string;
  width_mm: number;
  inner_diameter_mm: number;
  circumference_mm: number;
  indian_size: number;
  us_size: number;
  confidence: string;
  is_estimate: boolean;
  note: string;
}

export interface TryOnResult {
  id: string;
  session_id: string;
  photo_id: string;
  status: string;
  result_url: string | null;
  width: number | null;
  height: number | null;
  confidence: number | null;
  warnings: string[];
  placements: PlacementOut[];
  detection: DetectionSummary;
  ring_size_estimate: RingSizeEstimate | null;
  engine_version: string | null;
  processing_ms: number | null;
  items: TryOnItemIn[];
}

export interface TryOnCapabilities {
  photo_tryon: boolean;
  live_tryon: boolean;
  supported_types: string[];
  max_upload_mb: number;
}

/** A piece in the current look, with the customer's variant/slot choices. */
export interface LookItem {
  product: ProductSummary;
  variantId: string | null;
  slot: string | null;
  adjustments: Adjustments;
}

export type TryOnMode = "look" | "bridal";

export function buildItemsPayload(items: LookItem[]): TryOnItemIn[] {
  return items.map((item) => ({
    product_id: item.product.id,
    variant_id: item.variantId,
    size_id: null,
    slot: item.slot,
    adjustments: item.adjustments,
  }));
}

export interface SlotOption {
  value: string;
  label: string;
}

const HANDS: Array<[string, string]> = [
  ["right", "Right hand"],
  ["left", "Left hand"],
];
const FINGERS: Array<[string, string]> = [
  ["ring", "ring finger"],
  ["middle", "middle finger"],
  ["index", "index finger"],
  ["pinky", "little finger"],
];

/** Placement choices for a jewellery type; hands come from the detection when available. */
export function slotOptionsFor(type: JewelleryType, detection?: DetectionSummary): SlotOption[] {
  const detectedHands = detection?.hands?.map((h) => h.handedness.toLowerCase()) ?? [];
  const hands = detectedHands.length ? HANDS.filter(([v]) => detectedHands.includes(v)) : HANDS;
  switch (type) {
    case "ring":
      return hands.flatMap(([hand, handLabel]) =>
        FINGERS.map(([finger, fingerLabel]) => ({
          value: `${hand}_${finger}`,
          label: `${handLabel}, ${fingerLabel}`,
        })),
      );
    case "bangle":
    case "bracelet":
      return hands.map(([hand, label]) => ({ value: `${hand}_wrist`, label }));
    case "nose_ring":
      return [
        { value: "left_nostril", label: "Left side (as seen)" },
        { value: "right_nostril", label: "Right side (as seen)" },
      ];
    case "anklet":
      return [
        { value: "left_ankle", label: "Left ankle (as seen)" },
        { value: "right_ankle", label: "Right ankle (as seen)" },
      ];
    default:
      return [];
  }
}

export function defaultSlot(type: JewelleryType): string | null {
  const options = slotOptionsFor(type);
  return options[0]?.value ?? null;
}

export function makeLookItem(product: ProductSummary, variantId: string | null = null): LookItem {
  return {
    product,
    variantId,
    slot: defaultSlot(product.jewellery_type),
    adjustments: DEFAULT_ADJUSTMENTS,
  };
}

/** Re-applies the current slot/variant/adjustment choices from loaded product details. */
export function pickVariantId(
  detail: ProductDetail | undefined,
  requested: string | null,
): string | null {
  if (!detail || detail.variants.length === 0) return null;
  if (requested && detail.variants.some((v) => v.id === requested)) return requested;
  return detail.variants.find((v) => v.is_default)?.id ?? detail.variants[0]?.id ?? null;
}

/** Trailing-edge debounce that always invokes with the latest arguments. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}
