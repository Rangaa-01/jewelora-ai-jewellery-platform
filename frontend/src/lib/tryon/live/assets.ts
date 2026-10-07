/**
 * Loading and selecting product try-on assets for the browser renderer.
 * Mirrors `TryOnService._select_asset` on the backend.
 */

import type { ProductDetail, ProductVariant, TryOnAsset } from "@/lib/api/types";
import type { AssetGeometry } from "../fitting/types";
import { tintImage } from "./tint";

export type DrawableAsset = CanvasImageSource & { width: number; height: number };

export function selectAsset(product: ProductDetail, variantId: string | null): TryOnAsset | null {
  const assets = product.tryon_assets.filter((a) => a.view === "front");
  const pool = assets.length ? assets : product.tryon_assets;
  if (pool.length === 0) return null;
  if (variantId) {
    const exact = pool.find((a) => a.variant_id === variantId);
    if (exact) return exact;
  }
  return pool.find((a) => a.variant_id === null) ?? pool[0] ?? null;
}

/** Tint to apply when the asset is not variant-specific but a variant with a tint is chosen. */
export function tintFor(
  asset: TryOnAsset,
  variant: ProductVariant | null | undefined,
): string | null {
  if (!variant || asset.variant_id === variant.id) return null;
  return variant.tint_hex;
}

export function assetGeometry(product: ProductDetail, asset: TryOnAsset): AssetGeometry {
  return {
    width: asset.width,
    height: asset.height,
    anchors: Object.fromEntries(Object.entries(asset.anchors).map(([k, [x, y]]) => [k, { x, y }])),
    jewellery_type: product.jewellery_type,
    real_width_mm: asset.real_width_mm ? Number(asset.real_width_mm) : null,
    real_height_mm: asset.real_height_mm ? Number(asset.real_height_mm) : null,
    asset_id: asset.id,
  };
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const tintCache = new Map<string, DrawableAsset>();

export function loadAssetImage(url: string): Promise<HTMLImageElement> {
  let pending = imageCache.get(url);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => {
        imageCache.delete(url);
        reject(new Error("asset_load_failed"));
      };
      img.src = url;
    });
    imageCache.set(url, pending);
  }
  return pending;
}

/** Loads (and memoises) the drawable for an asset, pre-tinted when a tint is requested. */
export async function loadDrawable(
  asset: TryOnAsset,
  tintHex: string | null,
): Promise<DrawableAsset> {
  const image = await loadAssetImage(asset.url);
  if (!tintHex) return image;
  const key = `${asset.id}:${tintHex}`;
  const cached = tintCache.get(key);
  if (cached) return cached;
  const tinted = tintImage(image, tintHex);
  tintCache.set(key, tinted);
  return tinted;
}
