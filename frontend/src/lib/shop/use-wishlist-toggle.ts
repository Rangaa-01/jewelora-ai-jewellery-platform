"use client";

import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import {
  useAddWishlistItem,
  useOwnerKey,
  useRemoveWishlistItem,
  useWishlist,
} from "@/lib/api/hooks";
import type { ProductSummary } from "@/lib/api/types";
import { useUiStore } from "@/lib/stores/ui-store";

/** Server-backed wishlist membership for one product, with a sign-in prompt for guests. */
export function useWishlistToggle(product: Pick<ProductSummary, "id" | "name"> | null) {
  const { signedIn } = useOwnerKey();
  const wishlist = useWishlist();
  const add = useAddWishlistItem();
  const remove = useRemoveWishlistItem();
  const requestSignIn = useUiStore((s) => s.requestSignIn);
  const { toast } = useToast();

  const item = product
    ? (wishlist.data?.items.find((i) => i.product?.id === product.id) ?? null)
    : null;
  const wishlisted = !!item;
  const pending = add.isPending || remove.isPending;

  const run = async (variantId?: string | null) => {
    if (!product) return;
    try {
      if (item) {
        await remove.mutateAsync(item.id);
        toast({ title: "Removed from wishlist", description: product.name, durationMs: 2500 });
      } else {
        await add.mutateAsync({ product_id: product.id, variant_id: variantId ?? null });
        toast({
          title: "Saved to wishlist",
          description: product.name,
          tone: "success",
          durationMs: 2500,
        });
      }
    } catch (error) {
      toast({
        title: "Couldn't update your wishlist",
        description: errorMessage(error),
        tone: "error",
      });
    }
  };

  const toggle = (variantId?: string | null) => {
    if (!product) return;
    if (!signedIn) {
      requestSignIn({
        message: `Sign in to save ${product.name} to your wishlist and keep it across devices.`,
        onSuccess: () => void run(variantId),
      });
      return;
    }
    void run(variantId);
  };

  return { wishlisted, pending, toggle, signedIn };
}
