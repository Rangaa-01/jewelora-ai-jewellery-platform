"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/lib/api/hooks";
import type { JewelleryType, ProductSummary } from "@/lib/api/types";
import { JEWELLERY_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface ProductPickerProps {
  selected: ProductSummary[];
  onToggle: (product: ProductSummary) => void;
  types?: JewelleryType[];
  single?: boolean;
}

/** Searchable list of try-on-enabled products to add to the current look. */
export function ProductPicker({ selected, onToggle, types, single = false }: ProductPickerProps) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<JewelleryType | undefined>(types?.[0]);
  const query = useProducts({
    q: q || undefined,
    tryon_only: true,
    jewellery_type: type ? [type] : types,
    page_size: 24,
  });
  const list = query.data?.items ?? [];
  const ids = new Set(selected.map((p) => p.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="text-fg-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search try-on jewellery"
          aria-label="Search try-on jewellery"
          className="border-border-strong bg-bg-elevated focus-visible:border-fg focus-visible:outline-ring h-11 w-full rounded-sm border pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-0"
        />
      </div>
      {types && types.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jewellery type">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(type === t ? undefined : t)}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-xs",
                type === t ? "border-gold-deep bg-gold/15" : "border-border hover:border-fg",
              )}
            >
              {JEWELLERY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {query.isPending ? (
        <div className="grid grid-cols-3 gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      ) : query.error ? (
        <p
          role="alert"
          className="border-border bg-bg-muted text-fg-muted rounded-sm border p-3 text-sm"
        >
          The catalogue couldn&apos;t be loaded right now. You can still upload your photo and retry
          in a moment.
        </p>
      ) : list.length === 0 ? (
        <p className="border-border bg-bg-muted text-fg-muted rounded-sm border p-3 text-sm">
          No try-on-enabled pieces match{q ? ` “${q}”` : ""}. The shop marks pieces as try-on ready
          as assets are prepared.
        </p>
      ) : (
        <ul className="grid max-h-[26rem] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {list.map((p) => {
            const on = ids.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onToggle(p)}
                  aria-pressed={on}
                  disabled={single && !on && selected.length > 0}
                  className={cn(
                    "group relative block w-full overflow-hidden rounded-md border-2 text-left transition-colors disabled:opacity-40",
                    on ? "border-gold-deep" : "hover:border-border-strong border-transparent",
                  )}
                >
                  <div className="bg-bg-muted relative aspect-square">
                    {p.primary_image ? (
                      <Image
                        src={p.primary_image.url}
                        alt=""
                        fill
                        sizes="120px"
                        className="object-cover"
                      />
                    ) : (
                      <ProductImagePlaceholder />
                    )}
                  </div>
                  <span className="block truncate px-1.5 py-1 text-[0.7rem]">{p.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
