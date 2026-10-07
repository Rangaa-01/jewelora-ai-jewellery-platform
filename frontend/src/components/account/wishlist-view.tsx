"use client";

import { Calendar, Camera, Heart, Link2, MessageCircle, ShoppingBag, Trash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WishlistCompare } from "./wishlist-compare";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import {
  useAddToCart,
  useOwnerKey,
  useRemoveWishlistItem,
  useShareWishlist,
  useWishlist,
} from "@/lib/api/hooks";
import type { Wishlist, WishlistItem } from "@/lib/api/types";
import { copyToClipboard, whatsappShareUrl } from "@/lib/shop/share";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/utils";

function WishlistRow({
  item,
  readOnly,
  selected,
  onSelect,
}: {
  item: WishlistItem;
  readOnly: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const router = useRouter();
  const remove = useRemoveWishlistItem();
  const addToCart = useAddToCart();
  const { toast } = useToast();
  const product = item.product;
  if (!product) {
    return (
      <li className="border-border bg-bg-muted/40 text-fg-muted rounded-lg border p-4 text-sm">
        This piece is no longer available.
        {!readOnly && (
          <Button variant="link" size="sm" onClick={() => remove.mutate(item.id)}>
            Remove
          </Button>
        )}
      </li>
    );
  }
  return (
    <li
      className={cn(
        "border-border bg-bg-elevated flex gap-4 rounded-lg border p-4",
        selected && "border-gold-deep",
      )}
    >
      <Link
        href={`/products/${product.slug}`}
        className="bg-bg-muted relative size-24 shrink-0 overflow-hidden rounded-md sm:size-28"
      >
        {product.primary_image ? (
          <Image
            src={product.primary_image.url}
            alt=""
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <ProductImagePlaceholder />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/products/${product.slug}`} className="hover:text-accent-text font-medium">
            {product.name}
          </Link>
          <label className="text-fg-muted flex min-h-6 cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="size-4"
            />
            Compare
          </label>
        </div>
        <Price price={product.price} size="sm" className="mt-1" />
        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          {product.tryon_enabled && (
            <ButtonLink
              href={`/try-on?product=${product.slug}`}
              size="sm"
              variant="outline"
              leftIcon={<Camera className="size-3.5" aria-hidden />}
            >
              Try on
            </ButtonLink>
          )}
          <Button
            size="sm"
            variant="outline"
            leftIcon={<ShoppingBag className="size-3.5" aria-hidden />}
            loading={addToCart.isPending}
            onClick={() =>
              addToCart.mutate(
                { product_id: product.id, variant_id: item.variant_id, quantity: 1 },
                {
                  onSuccess: () =>
                    toast({ title: "Added to your bag", tone: "success", durationMs: 2500 }),
                  onError: (e) =>
                    toast({
                      title: "Couldn't add to bag",
                      description: errorMessage(e),
                      tone: "error",
                      action: {
                        label: "Choose options",
                        onClick: () => router.push(`/products/${product.slug}`),
                      },
                    }),
                },
              )
            }
          >
            Add to bag
          </Button>
          <ButtonLink
            href={`/enquire?product=${product.slug}`}
            size="sm"
            variant="ghost"
            leftIcon={<MessageCircle className="size-3.5" aria-hidden />}
          >
            Enquire
          </ButtonLink>
          {!readOnly && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${product.name}`}
              leftIcon={<Trash className="size-3.5" aria-hidden />}
              loading={remove.isPending}
              onClick={() => remove.mutate(item.id)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function WishlistItems({ wishlist, readOnly }: { wishlist: Wishlist; readOnly: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const products = wishlist.items.flatMap((i) => (i.product ? [i.product] : []));
  const compared = products.filter((p) => selected.includes(p.id));
  const slugs = products.map((p) => p.slug).join(",");
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          href={`/try-on?products=${slugs}`}
          variant="outline"
          leftIcon={<Camera className="size-4" aria-hidden />}
        >
          Try all on
        </ButtonLink>
        <ButtonLink
          href={`/appointments/new?products=${slugs}`}
          variant="outline"
          leftIcon={<Calendar className="size-4" aria-hidden />}
        >
          Book a visit
        </ButtonLink>
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {wishlist.items.map((item) => (
          <WishlistRow
            key={item.id}
            item={item}
            readOnly={readOnly}
            selected={!!item.product && selected.includes(item.product.id)}
            onSelect={(checked) => {
              if (!item.product) return;
              const id = item.product.id;
              setSelected((s) => {
                if (!checked) return s.filter((x) => x !== id);
                if (s.length >= 4) return s;
                return [...s, id];
              });
            }}
          />
        ))}
      </ul>
      <WishlistCompare
        products={compared}
        onRemove={(id) => setSelected((s) => s.filter((x) => x !== id))}
      />
    </>
  );
}

export function WishlistView() {
  const { signedIn, pending } = useOwnerKey();
  const wishlist = useWishlist();
  const share = useShareWishlist();
  const requestSignIn = useUiStore((s) => s.requestSignIn);
  const { toast } = useToast();

  const onShare = async () => {
    try {
      const result = await share.mutateAsync();
      const url = result.share_url ?? "";
      const copied = await copyToClipboard(url);
      toast({
        title: copied ? "Link copied" : "Share link ready",
        description: url,
        tone: "success",
        action: {
          label: "Share on WhatsApp",
          onClick: () =>
            window.open(whatsappShareUrl("My Jewelora wishlist", url), "_blank", "noopener"),
        },
      });
    } catch (error) {
      toast({
        title: "Couldn't create a share link",
        description: errorMessage(error),
        tone: "error",
      });
    }
  };

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Wishlist</p>
            <h1 className="text-4xl md:text-5xl">Saved jewellery</h1>
          </div>
          {signedIn && wishlist.data && wishlist.data.items.length > 0 && (
            <Button
              variant="outline"
              leftIcon={<Link2 className="size-4" aria-hidden />}
              loading={share.isPending}
              onClick={() => void onShare()}
            >
              Share wishlist
            </Button>
          )}
        </div>
        <div className="mt-8">
          {pending || (signedIn && wishlist.isPending) ? (
            <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : !signedIn ? (
            <EmptyState
              icon={Heart}
              title="Sign in to see your wishlist"
              description="Your wishlist is saved to your account so it follows you across devices and can be shared with the store."
              action={
                <div className="flex gap-3">
                  <Button
                    onClick={() =>
                      requestSignIn({ message: "Sign in to see and share your saved jewellery." })
                    }
                  >
                    Sign in
                  </Button>
                  <ButtonLink href="/products" variant="outline">
                    Browse jewellery
                  </ButtonLink>
                </div>
              }
            />
          ) : wishlist.error || !wishlist.data ? (
            <ErrorState
              title="We couldn't load your wishlist"
              onRetry={() => void wishlist.refetch()}
            />
          ) : wishlist.data.items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Nothing saved yet"
              description="Tap the heart on any piece to keep it here, compare, try on, or send to the store."
              action={<ButtonLink href="/products">Browse jewellery</ButtonLink>}
            />
          ) : (
            <WishlistItems wishlist={wishlist.data} readOnly={false} />
          )}
        </div>
      </Container>
    </Section>
  );
}
