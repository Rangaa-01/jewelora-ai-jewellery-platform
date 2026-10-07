import type { JewelleryType, MetalType, StoneType } from "./api/types";

export const METAL_LABELS: Record<MetalType, string> = {
  gold: "Yellow Gold",
  white_gold: "White Gold",
  rose_gold: "Rose Gold",
  platinum: "Platinum",
  silver: "Silver",
};

export const METAL_SWATCH: Record<MetalType, string> = {
  gold: "#d4af37",
  white_gold: "#e6e6e6",
  rose_gold: "#d9a68f",
  platinum: "#cfd3d6",
  silver: "#c0c0c0",
};

export const STONE_LABELS: Record<StoneType, string> = {
  none: "No stones",
  diamond: "Diamond",
  ruby: "Ruby",
  emerald: "Emerald",
  sapphire: "Sapphire",
  pearl: "Pearl",
  polki: "Polki",
  kundan: "Kundan",
  cz: "Cubic Zirconia",
};

export const JEWELLERY_TYPE_LABELS: Record<JewelleryType, string> = {
  necklace: "Necklaces",
  chain: "Chains",
  pendant: "Pendants",
  haram: "Harams",
  choker: "Chokers",
  earrings: "Earrings",
  ring: "Rings",
  bangle: "Bangles",
  bracelet: "Bracelets",
  nose_ring: "Nose Rings",
  maang_tikka: "Maang Tikka",
  waist_chain: "Waist Chains",
  anklet: "Anklets",
  set: "Jewellery Sets",
};

export const TRYON_TYPES: JewelleryType[] = [
  "necklace",
  "chain",
  "pendant",
  "haram",
  "choker",
  "earrings",
  "ring",
  "bangle",
  "bracelet",
  "nose_ring",
  "maang_tikka",
  "waist_chain",
  "anklet",
  "set",
];
