"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import type { ProductDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Hosts the product visual: image gallery now, and the interactive 3D viewer (Phase 5)
 * when `product.model_3d_assets` is non-empty. Keeping the slot stable lets the detail
 * page layout stay unchanged when the viewer lands.
 */
export function ProductViewerSlot({
  product,
  variantId,
}: {
  product: ProductDetail;
  variantId: string | null;
}) {
  const images = product.images.filter((img) => !img.variant_id || img.variant_id === variantId);
  const list = images.length ? images : product.images;
  const [index, setIndex] = useState(0);
  const current = list[Math.min(index, Math.max(0, list.length - 1))];

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-24">
      <div className="bg-bg-muted relative aspect-square overflow-hidden rounded-lg">
        {current ? (
          <Image
            key={current.id}
            src={current.url}
            alt={current.alt_text || product.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            preload
          />
        ) : (
          <ProductImagePlaceholder />
        )}
      </div>
      {list.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
          {list.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1}${img.view ? ` (${img.view})` : ""}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "bg-bg-muted relative size-16 shrink-0 overflow-hidden rounded-sm border-2 sm:size-20",
                  i === index
                    ? "border-gold-deep"
                    : "hover:border-border-strong border-transparent",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
