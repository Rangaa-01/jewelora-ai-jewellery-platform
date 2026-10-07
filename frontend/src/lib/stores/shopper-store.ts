"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LocalCartItem {
  productId: string;
  slug: string;
  name: string;
  price: string;
  imageUrl: string | null;
  variantId: string | null;
  variantLabel: string | null;
  sizeId: string | null;
  sizeLabel: string | null;
  quantity: number;
}

export interface LocalWishlistItem {
  productId: string;
  slug: string;
  name: string;
  price: string;
  imageUrl: string | null;
  addedAt: string;
}

interface ShopperState {
  cart: LocalCartItem[];
  wishlist: LocalWishlistItem[];
  recentlyViewed: string[];
  addToCart: (item: Omit<LocalCartItem, "quantity">, quantity?: number) => void;
  updateCartQuantity: (key: string, quantity: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  toggleWishlist: (item: Omit<LocalWishlistItem, "addedAt">) => boolean;
  removeFromWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  markViewed: (slug: string) => void;
}

export function cartItemKey(
  item: Pick<LocalCartItem, "productId" | "variantId" | "sizeId">,
): string {
  return `${item.productId}:${item.variantId ?? "-"}:${item.sizeId ?? "-"}`;
}

/**
 * Local (device) cart & wishlist. These keep guests productive before sign-in; once a
 * customer is authenticated the account pages sync them with the backend.
 */
export const useShopperStore = create<ShopperState>()(
  persist(
    (set, get) => ({
      cart: [],
      wishlist: [],
      recentlyViewed: [],
      addToCart: (item, quantity = 1) =>
        set((state) => {
          const key = cartItemKey(item);
          const existing = state.cart.find((c) => cartItemKey(c) === key);
          if (existing) {
            return {
              cart: state.cart.map((c) =>
                cartItemKey(c) === key
                  ? { ...c, quantity: Math.min(10, c.quantity + quantity) }
                  : c,
              ),
            };
          }
          return { cart: [...state.cart, { ...item, quantity }] };
        }),
      updateCartQuantity: (key, quantity) =>
        set((state) => ({
          cart:
            quantity <= 0
              ? state.cart.filter((c) => cartItemKey(c) !== key)
              : state.cart.map((c) => (cartItemKey(c) === key ? { ...c, quantity } : c)),
        })),
      removeFromCart: (key) =>
        set((state) => ({ cart: state.cart.filter((c) => cartItemKey(c) !== key) })),
      clearCart: () => set({ cart: [] }),
      toggleWishlist: (item) => {
        const exists = get().wishlist.some((w) => w.productId === item.productId);
        set((state) => ({
          wishlist: exists
            ? state.wishlist.filter((w) => w.productId !== item.productId)
            : [{ ...item, addedAt: new Date().toISOString() }, ...state.wishlist],
        }));
        return !exists;
      },
      removeFromWishlist: (productId) =>
        set((state) => ({ wishlist: state.wishlist.filter((w) => w.productId !== productId) })),
      isWishlisted: (productId) => get().wishlist.some((w) => w.productId === productId),
      markViewed: (slug) =>
        set((state) => ({
          recentlyViewed: [slug, ...state.recentlyViewed.filter((s) => s !== slug)].slice(0, 12),
        })),
    }),
    { name: "jewelora-shopper", version: 1 },
  ),
);

export const selectCartCount = (s: ShopperState) => s.cart.reduce((n, c) => n + c.quantity, 0);
export const selectWishlistCount = (s: ShopperState) => s.wishlist.length;
