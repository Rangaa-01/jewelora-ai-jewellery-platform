"use client";

import { X } from "lucide-react";
import Image from "next/image";
import type { ProductDetail } from "@/lib/api/types";
import { JEWELLERY_TYPE_LABELS, METAL_LABELS } from "@/lib/labels";
import { STRAND_TYPES } from "@/lib/tryon/fitting/strand";
import { slotOptionsFor, type DetectionSummary, type LookItem } from "@/lib/tryon/session";

interface LookItemListProps {
  items: LookItem[];
  details: Record<string, ProductDetail | undefined>;
  detection?: DetectionSummary;
  onRemove: (productId: string) => void;
  onVariantChange: (productId: string, variantId: string | null) => void;
  onSizeChange: (productId: string, sizeId: string | null) => void;
  onSlotChange: (productId: string, slot: string | null) => void;
}

/** Sizes worth offering in try-on: at least two, labelled by their length/measurement. */
export function sizeOptionsFor(detail: ProductDetail | undefined) {
  const sizes = detail?.sizes ?? [];
  return sizes.length > 1 ? sizes : [];
}

const selectClasses =
  "border-border-strong bg-bg-elevated focus-visible:outline-ring h-9 min-w-0 rounded-sm border px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-0";

/** The pieces in the current look, each with metal (variant) and placement (slot) choices. */
export function LookItemList({
  items,
  details,
  detection,
  onRemove,
  onVariantChange,
  onSizeChange,
  onSlotChange,
}: LookItemListProps) {
  if (items.length === 0) {
    return (
      <p className="border-border-strong text-fg-muted rounded-sm border border-dashed p-3 text-sm">
        No pieces yet. Pick from the catalogue below.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map(({ product, variantId, sizeId, slot }) => {
        const detail = details[product.slug];
        const variants = detail?.variants.filter((v) => v.is_active) ?? [];
        const sizes = sizeOptionsFor(detail);
        const defaultSize = sizes.find((sz) => sz.is_default) ?? sizes[0];
        const slots = slotOptionsFor(product.jewellery_type, detection);
        return (
          <li
            key={product.id}
            className="border-border bg-bg-elevated flex flex-col gap-2 rounded-md border p-2"
          >
            <div className="flex items-center gap-3">
              <div className="bg-bg-muted relative size-12 shrink-0 overflow-hidden rounded-sm">
                {product.primary_image && (
                  <Image
                    src={product.primary_image.url}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-fg-muted text-xs">
                  {JEWELLERY_TYPE_LABELS[product.jewellery_type]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(product.id)}
                className="touch-target text-fg-muted hover:text-fg inline-flex items-center justify-center"
                aria-label={`Remove ${product.name}`}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {(variants.length > 1 || sizes.length > 0 || slots.length > 0) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {variants.length > 1 && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-muted">Metal</span>
                    <select
                      className={selectClasses}
                      value={variantId ?? ""}
                      onChange={(e) => onVariantChange(product.id, e.target.value || null)}
                    >
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {METAL_LABELS[v.metal_type]}
                          {v.purity ? ` · ${v.purity}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {sizes.length > 0 && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-muted">
                      {STRAND_TYPES.has(product.jewellery_type) ? "Length" : "Size"}
                    </span>
                    <select
                      className={selectClasses}
                      value={sizeId ?? defaultSize?.id ?? ""}
                      onChange={(e) => onSizeChange(product.id, e.target.value || null)}
                    >
                      {sizes.map((sz) => (
                        <option key={sz.id} value={sz.id}>
                          {sz.label}
                          {sz.measurement_mm ? ` · ${Number(sz.measurement_mm)} mm` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {slots.length > 0 && (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-fg-muted">Wear on</span>
                    <select
                      className={selectClasses}
                      value={slot ?? slots[0]!.value}
                      onChange={(e) => onSlotChange(product.id, e.target.value)}
                    >
                      {slots.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
