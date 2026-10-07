"use client";

import type { ProductSize, ProductVariant } from "@/lib/api/types";
import { METAL_LABELS, METAL_SWATCH, STONE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function variantLabel(v: ProductVariant): string {
  const parts = [METAL_LABELS[v.metal_type]];
  if (v.purity) parts.push(v.purity);
  if (v.stone_type !== "none") parts.push(STONE_LABELS[v.stone_type]);
  return parts.join(" · ");
}

export function VariantSelector({
  variants,
  value,
  onChange,
}: {
  variants: ProductVariant[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const active = variants.filter((v) => v.is_active);
  if (active.length === 0) return null;
  return (
    <fieldset>
      <legend className="text-fg-soft mb-2 text-sm font-medium">
        Metal &amp; stone
        <span className="text-fg-muted ml-2 font-normal">
          {active.find((v) => v.id === value)
            ? variantLabel(active.find((v) => v.id === value)!)
            : ""}
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {active.map((v) => {
          const selected = v.id === value;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onChange(v.id)}
              aria-pressed={selected}
              aria-label={variantLabel(v)}
              title={variantLabel(v)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
                selected ? "border-gold-deep bg-gold/15" : "border-border hover:border-fg",
                v.stock_quantity === 0 && "opacity-60",
              )}
            >
              <span
                aria-hidden
                className="border-ink/20 size-4 rounded-full border"
                style={{ background: v.tint_hex ?? METAL_SWATCH[v.metal_type] }}
              />
              {METAL_LABELS[v.metal_type]}
              {v.stone_type !== "none" && (
                <span className="text-fg-muted">· {STONE_LABELS[v.stone_type]}</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SizeSelector({
  sizes,
  value,
  onChange,
  kind,
}: {
  sizes: ProductSize[];
  value: string | null;
  onChange: (id: string) => void;
  kind: string;
}) {
  if (sizes.length === 0) return null;
  const label =
    kind === "ring"
      ? "Ring size"
      : kind === "bangle"
        ? "Bangle size"
        : kind === "bracelet"
          ? "Bracelet size"
          : "Length";
  return (
    <fieldset>
      <legend className="text-fg-soft mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => {
          const selected = s.id === value;
          const out = s.stock_quantity === 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              aria-pressed={selected}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border px-3 text-sm transition-colors",
                selected ? "border-gold-deep bg-gold/15" : "border-border hover:border-fg",
                out && "text-fg-muted line-through",
              )}
              title={s.measurement_mm ? `${s.measurement_mm} mm` : undefined}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {kind === "ring" && (
        <p className="text-fg-muted mt-2 text-xs">
          Not sure? The try-on studio can estimate your size from a photo of your hand. Estimates
          must be confirmed in store.
        </p>
      )}
    </fieldset>
  );
}
