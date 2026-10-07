import type { JewelleryType, ProductDetail, ProductVariant } from "@/lib/api/types";
import type { Adjustments, AssetGeometry, Landmarks, Placement } from "../fitting/types";
import type { DrawableAsset } from "./assets";

/** One jewellery piece prepared for the live overlay. */
export interface LiveItem {
  product: ProductDetail;
  variant: ProductVariant | null;
  slot: string | null;
  /** Length of the chosen (or default) size in mm; drives how far a strand hangs. */
  lengthMm: number | null;
  adjustments: Adjustments;
  geometry: AssetGeometry;
  drawable: DrawableAsset;
}

export interface LivePlacement {
  item: LiveItem;
  placement: Placement;
}

export interface LiveFrame {
  landmarks: Landmarks;
  placements: LivePlacement[];
  /** Jewellery types whose anchors could not be found this frame (for on-screen hints). */
  missing: JewelleryType[];
}

export type LiveQuality = "auto" | "low" | "high";
export type Facing = "user" | "environment";

export interface LiveStats {
  fps: number;
  inferenceMs: number;
  delegate: "GPU" | "CPU";
}
