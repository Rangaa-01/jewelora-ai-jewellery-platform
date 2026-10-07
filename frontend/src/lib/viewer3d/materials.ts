/**
 * Pure helpers for the 3D viewer: material classification by name, metal/gem presets,
 * variant → model resolution and option lists. No three.js imports so these can be unit
 * tested cheaply and reused by any renderer.
 *
 * Material naming convention for uploaded GLBs: `<anything>_metal` for metal parts and
 * `<stone>_gem` (e.g. `ruby_gem`, `diamond_gem`) for stones. Other names are left as authored.
 */

import type { MetalType, Model3DAsset, ProductVariant, StoneType } from "@/lib/api/types";
import { METAL_SWATCH } from "@/lib/labels";

export type MaterialKind = "metal" | "gem" | "other";

export function classifyMaterialName(name: string | undefined | null): MaterialKind {
  const n = (name ?? "").toLowerCase();
  if (/(^|[_\-\s])metal$/.test(n) || n === "metal") return "metal";
  if (/(^|[_\-\s])gem$/.test(n) || n === "gem") return "gem";
  return "other";
}

/** Stone kind encoded in a gem material name (`ruby_gem` → `ruby`), if recognisable. */
export function stoneFromMaterialName(name: string | undefined | null): StoneType | null {
  const n = (name ?? "").toLowerCase();
  const match = n.match(/^([a-z]+)[_\-\s]gem$/);
  if (!match) return null;
  const kind = match[1] as StoneType;
  return kind in GEM_PRESETS ? kind : null;
}

/** Physical metal colours tuned for a PBR workflow (slightly brighter than UI swatches). */
export const METAL_COLORS: Record<MetalType, string> = {
  gold: "#e3b85c",
  white_gold: "#e9e9ee",
  rose_gold: "#dfa08a",
  platinum: "#d6d9de",
  silver: "#d9d9dc",
};

export interface MetalPreset {
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
}

export function metalPreset(metal: MetalType, tintHex?: string | null): MetalPreset {
  return {
    color: tintHex && /^#[0-9a-f]{6}$/i.test(tintHex) ? tintHex : METAL_COLORS[metal],
    metalness: 1,
    roughness: metal === "platinum" || metal === "silver" ? 0.28 : 0.2,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.3,
  };
}

export interface GemPreset {
  color: string;
  transmission: number;
  ior: number;
  thickness: number;
  roughness: number;
  clearcoat: number;
  attenuationColor: string;
  attenuationDistance: number;
  envMapIntensity: number;
  /** Diamonds and clear stones get a sparkle layer; opaque beads do not. */
  sparkle: boolean;
}

export const GEM_PRESETS: Record<StoneType, GemPreset> = {
  diamond: {
    color: "#ffffff",
    transmission: 0.95,
    ior: 2.42,
    thickness: 0.9,
    roughness: 0.02,
    clearcoat: 1,
    attenuationColor: "#fff9ee",
    attenuationDistance: 1.5,
    envMapIntensity: 1.6,
    sparkle: true,
  },
  cz: {
    color: "#ffffff",
    transmission: 0.92,
    ior: 2.15,
    thickness: 0.9,
    roughness: 0.03,
    clearcoat: 1,
    attenuationColor: "#f8fbff",
    attenuationDistance: 1.5,
    envMapIntensity: 1.5,
    sparkle: true,
  },
  ruby: {
    color: "#c8102e",
    transmission: 0.62,
    ior: 1.77,
    thickness: 1.2,
    roughness: 0.05,
    clearcoat: 1,
    attenuationColor: "#7a0015",
    attenuationDistance: 0.8,
    envMapIntensity: 1.2,
    sparkle: true,
  },
  emerald: {
    color: "#1b9a5a",
    transmission: 0.55,
    ior: 1.58,
    thickness: 1.2,
    roughness: 0.08,
    clearcoat: 0.9,
    attenuationColor: "#0a5a32",
    attenuationDistance: 0.8,
    envMapIntensity: 1.1,
    sparkle: true,
  },
  sapphire: {
    color: "#1f3fb8",
    transmission: 0.62,
    ior: 1.77,
    thickness: 1.2,
    roughness: 0.05,
    clearcoat: 1,
    attenuationColor: "#0c1f6a",
    attenuationDistance: 0.8,
    envMapIntensity: 1.2,
    sparkle: true,
  },
  pearl: {
    color: "#faf6ee",
    transmission: 0,
    ior: 1.5,
    thickness: 0,
    roughness: 0.25,
    clearcoat: 0.8,
    attenuationColor: "#ffffff",
    attenuationDistance: 1,
    envMapIntensity: 0.9,
    sparkle: false,
  },
  polki: {
    color: "#f4efe0",
    transmission: 0.35,
    ior: 2.3,
    thickness: 0.6,
    roughness: 0.12,
    clearcoat: 0.9,
    attenuationColor: "#e8dcb8",
    attenuationDistance: 1,
    envMapIntensity: 1.2,
    sparkle: true,
  },
  kundan: {
    color: "#f3e7c3",
    transmission: 0.25,
    ior: 1.9,
    thickness: 0.6,
    roughness: 0.15,
    clearcoat: 0.9,
    attenuationColor: "#d9c38a",
    attenuationDistance: 1,
    envMapIntensity: 1.1,
    sparkle: false,
  },
  none: {
    color: "#f3e7c3",
    transmission: 0,
    ior: 1.5,
    thickness: 0,
    roughness: 0.3,
    clearcoat: 0.5,
    attenuationColor: "#ffffff",
    attenuationDistance: 1,
    envMapIntensity: 1,
    sparkle: false,
  },
};

export function gemPreset(stone: StoneType | null | undefined): GemPreset {
  return GEM_PRESETS[stone ?? "none"];
}

/** The GLB to show for a variant: its own model if one exists, else the primary model. */
export function pickModelForVariant(
  assets: Model3DAsset[],
  variantId: string | null,
): Model3DAsset | null {
  const glbs = assets.filter((a) => a.format === "glb");
  if (glbs.length === 0) return null;
  if (variantId) {
    const own = glbs.find((a) => a.variant_id === variantId);
    if (own) return own;
  }
  return (
    glbs.find((a) => a.is_primary && !a.variant_id) ??
    glbs.find((a) => a.is_primary) ??
    glbs.find((a) => !a.variant_id) ??
    glbs[0] ??
    null
  );
}

export interface SwitchOption<T extends string> {
  value: T;
  /** Variant to select when this option is chosen. */
  variantId: string;
}

/** Metal options actually offered by the product, one per metal, preferring the current stone. */
export function metalOptions(
  variants: ProductVariant[],
  currentVariantId: string | null,
): SwitchOption<MetalType>[] {
  const active = variants.filter((v) => v.is_active);
  const current = active.find((v) => v.id === currentVariantId) ?? null;
  const seen = new Map<MetalType, string>();
  for (const v of active) {
    const existing = seen.get(v.metal_type);
    if (!existing) {
      seen.set(v.metal_type, v.id);
    } else if (current && v.stone_type === current.stone_type) {
      const prev = active.find((x) => x.id === existing);
      if (prev && prev.stone_type !== current.stone_type) seen.set(v.metal_type, v.id);
    }
  }
  return [...seen.entries()].map(([value, variantId]) => ({ value, variantId }));
}

/** Stone options offered for the current metal (only when the product has ≥ 2 stone types). */
export function stoneOptions(
  variants: ProductVariant[],
  currentVariantId: string | null,
): SwitchOption<StoneType>[] {
  const active = variants.filter((v) => v.is_active);
  const stones = new Set(active.map((v) => v.stone_type));
  if (stones.size < 2) return [];
  const current = active.find((v) => v.id === currentVariantId) ?? null;
  const seen = new Map<StoneType, string>();
  for (const v of active) {
    const existing = seen.get(v.stone_type);
    if (!existing) seen.set(v.stone_type, v.id);
    else if (current && v.metal_type === current.metal_type) {
      const prev = active.find((x) => x.id === existing);
      if (prev && prev.metal_type !== current.metal_type) seen.set(v.stone_type, v.id);
    }
  }
  return [...seen.entries()].map(([value, variantId]) => ({ value, variantId }));
}

/** UI swatch colour for a metal option. */
export function swatchFor(metal: MetalType, variants: ProductVariant[]): string {
  return (
    variants.find((v) => v.metal_type === metal && v.tint_hex)?.tint_hex ?? METAL_SWATCH[metal]
  );
}
