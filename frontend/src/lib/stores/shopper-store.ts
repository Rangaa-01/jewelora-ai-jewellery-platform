"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ShopperState {
  recentlyViewed: string[];
  markViewed: (slug: string) => void;
}

/**
 * Device-local shopper conveniences. The cart and wishlist live on the server (see
 * `useCart` / `useWishlist` in `@/lib/api/hooks`); only recently viewed slugs stay local.
 */
export const useShopperStore = create<ShopperState>()(
  persist(
    (set) => ({
      recentlyViewed: [],
      markViewed: (slug) =>
        set((state) => ({
          recentlyViewed: [slug, ...state.recentlyViewed.filter((s) => s !== slug)].slice(0, 12),
        })),
    }),
    { name: "jewelora-shopper", version: 2 },
  ),
);
