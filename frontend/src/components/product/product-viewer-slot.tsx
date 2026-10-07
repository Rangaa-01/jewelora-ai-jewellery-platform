"use client";

import { Images } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { Button } from "@/components/ui/button";
import { JewelleryViewer, View3DButton } from "@/components/viewer3d";
import type { ProductDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { pickModelForVariant } from "@/lib/viewer3d/materials";

/**
 * Hosts the product visual: the photo gallery by default, and the interactive 3D viewer
 * when `product.model_3d_assets` is non-empty and the customer asks for it. three.js is
 * only loaded once "View in 3D" is used (preloaded on hover/focus).
 */
export function ProductViewerSlot({
  product,
  variantId,
  onSelectVariant,
}: {
  product: ProductDetail;
  variantId: string | null;
  onSelectVariant?: (variantId: string) => void;
}) {
  const images = product.images.filter((img) => !img.variant_id || img.variant_id === variantId);
  const list = images.length ? images : product.images;
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"photos" | "3d">("photos");
  const [unavailable, setUnavailable] = useState(false);
  const current = list[Math.min(index, Math.max(0, list.length - 1))];
  const model = pickModelForVariant(product.model_3d_assets, variantId);
  const has3d = !!model && !unavailable;
  const show3d = mode === "3d" && has3d;

  const onUnavailable = useCallback(() => {
    // Keep the photos usable: the viewer explains why 3D failed, and we stop offering it.
    setUnavailable(true);
    setMode("photos");
  }, []);

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-24">
      {show3d ? (
        <JewelleryViewer
          product={product}
          variantId={variantId}
          onVariantChange={onSelectVariant}
          onUnavailable={onUnavailable}
        />
      ) : (
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
      )}
      {has3d && (
        <div className="flex gap-2" role="group" aria-label="View mode">
          <View3DButton url={model?.url ?? null} active={show3d} onClick={() => setMode("3d")} />
          <Button
            type="button"
            variant={show3d ? "outline" : "primary"}
            size="md"
            aria-pressed={!show3d}
            onClick={() => setMode("photos")}
            leftIcon={<Images className="size-4" aria-hidden />}
          >
            Photos
          </Button>
        </div>
      )}
      {!show3d && list.length > 1 && (
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
