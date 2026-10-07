"use client";

import { Box, Camera, Gem, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { useToast } from "@/components/ui/toast";
import type { ProductSummary } from "@/lib/api/types";
import { METAL_LABELS } from "@/lib/labels";
import { useShopperStore } from "@/lib/stores/shopper-store";
import { cn } from "@/lib/utils";

export function ProductImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_30%,var(--color-sand),var(--bg-muted))]",
        className,
      )}
    >
      <Gem className="text-gold/60 size-10" />
    </div>
  );
}

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  const { toast } = useToast();
  const toggleWishlist = useShopperStore((s) => s.toggleWishlist);
  const wishlisted = useShopperStore((s) => s.wishlist.some((w) => w.productId === product.id));
  const [hover, setHover] = useState(false);
  const image = product.primary_image;
  const hoverImage = product.hover_image;
  const href = `/products/${product.slug}` as const;

  const onWishlist = () => {
    const added = toggleWishlist({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      imageUrl: image?.url ?? null,
    });
    toast({
      title: added ? "Saved to wishlist" : "Removed from wishlist",
      description: product.name,
      tone: "success",
      durationMs: 2500,
    });
  };

  return (
    <article
      className="group relative flex flex-col"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <Link
        href={href}
        className="bg-bg-muted relative block aspect-[4/5] overflow-hidden rounded-md"
        aria-label={product.name}
      >
        {image ? (
          <>
            <Image
              src={image.url}
              alt={image.alt_text || product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={cn(
                "object-cover transition-[transform,opacity] duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.04]",
                hoverImage && hover && "opacity-0",
              )}
              preload={priority}
              loading={priority ? "eager" : "lazy"}
            />
            {hoverImage && (
              <Image
                src={hoverImage.url}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={cn(
                  "object-cover transition-opacity duration-700",
                  hover ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
            )}
          </>
        ) : (
          <ProductImagePlaceholder />
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {product.is_new && <Badge tone="emerald">New</Badge>}
          {Number(product.discount_percent) > 0 && (
            <Badge tone="rose">{Number(product.discount_percent)}% off</Badge>
          )}
          {!product.in_stock && !product.is_made_to_order && <Badge tone="neutral">Sold out</Badge>}
        </div>
        <div className="absolute bottom-2 left-2 flex gap-1">
          {product.tryon_enabled && (
            <span className="bg-ink/75 text-ivory inline-flex items-center gap-1 rounded-xs px-2 py-1 text-[0.65rem] font-semibold tracking-wider uppercase backdrop-blur-sm">
              <Camera className="size-3" aria-hidden /> Try-on
            </span>
          )}
          {product.has_3d && (
            <span className="bg-ink/75 text-ivory inline-flex items-center gap-1 rounded-xs px-2 py-1 text-[0.65rem] font-semibold tracking-wider uppercase backdrop-blur-sm">
              <Box className="size-3" aria-hidden /> 3D
            </span>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={onWishlist}
        aria-pressed={wishlisted}
        aria-label={
          wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`
        }
        className="touch-target text-ivory absolute top-1 right-1 inline-flex items-center justify-center rounded-full drop-shadow-md transition-transform hover:scale-110"
      >
        <Heart
          className={cn("size-5", wishlisted ? "fill-gold text-gold" : "fill-ink/30")}
          aria-hidden
        />
      </button>
      <div className="mt-3 flex flex-col gap-1">
        <p className="text-fg-muted text-[0.7rem] tracking-[0.14em] uppercase">
          {METAL_LABELS[product.metal_type]}
          {product.purity ? ` · ${product.purity}` : ""}
        </p>
        <h3 className="text-fg font-sans text-sm leading-snug font-medium">
          <Link href={href} className="hover:text-accent-text">
            {product.name}
          </Link>
        </h3>
        <Price
          price={product.price}
          basePrice={product.base_price}
          discountPercent={product.discount_percent}
          size="sm"
        />
      </div>
    </article>
  );
}
