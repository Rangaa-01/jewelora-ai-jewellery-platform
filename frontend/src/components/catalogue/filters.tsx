"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import type {
  Category,
  Gender,
  JewelleryType,
  MetalType,
  ProductFilters,
  ProductSort,
  StoneType,
} from "@/lib/api/types";
import { JEWELLERY_TYPE_LABELS, METAL_LABELS, STONE_LABELS, TRYON_TYPES } from "@/lib/labels";
import { cn } from "@/lib/utils";

const METALS = Object.keys(METAL_LABELS) as MetalType[];
const STONES = (Object.keys(STONE_LABELS) as StoneType[]).filter((s) => s !== "none");
const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "unisex", label: "Unisex" },
  { value: "kids", label: "Kids" },
];
const PRICE_BANDS: Array<{ label: string; min?: number; max?: number }> = [
  { label: "Under ₹25,000", max: 25000 },
  { label: "₹25,000 – ₹75,000", min: 25000, max: 75000 },
  { label: "₹75,000 – ₹2 L", min: 75000, max: 200000 },
  { label: "₹2 L – ₹5 L", min: 200000, max: 500000 },
  { label: "Above ₹5 L", min: 500000 },
];
export const SORT_OPTIONS: Array<{ value: ProductSort; label: string }> = [
  { value: "relevance", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

interface FilterPanelProps {
  filters: ProductFilters;
  categories: Category[];
  onChange: (next: ProductFilters) => void;
}

function toggleIn<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];
  return next.length ? next : undefined;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition-colors",
        active
          ? "border-gold-deep bg-gold/20 text-fg"
          : "border-border text-fg-soft hover:border-fg",
      )}
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-border border-b py-5 first:pt-0">
      <legend className="eyebrow mb-3">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function FilterPanel({ filters, categories, onChange }: FilterPanelProps) {
  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch, page: 1 });
  const activeBand = PRICE_BANDS.findIndex(
    (b) => b.min === filters.min_price && b.max === filters.max_price,
  );
  return (
    <div>
      {categories.length > 0 && (
        <Group title="Category">
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={filters.category === c.slug}
              onClick={() => set({ category: filters.category === c.slug ? undefined : c.slug })}
            >
              {c.name}
            </Chip>
          ))}
        </Group>
      )}
      {categories.length === 0 && (
        <Group title="Type">
          {TRYON_TYPES.map((t) => (
            <Chip
              key={t}
              active={!!filters.jewellery_type?.includes(t)}
              onClick={() =>
                set({ jewellery_type: toggleIn<JewelleryType>(filters.jewellery_type, t) })
              }
            >
              {JEWELLERY_TYPE_LABELS[t]}
            </Chip>
          ))}
        </Group>
      )}
      <Group title="Metal">
        {METALS.map((m) => (
          <Chip
            key={m}
            active={!!filters.metal_type?.includes(m)}
            onClick={() => set({ metal_type: toggleIn<MetalType>(filters.metal_type, m) })}
          >
            {METAL_LABELS[m]}
          </Chip>
        ))}
      </Group>
      <Group title="Stones">
        {STONES.map((s) => (
          <Chip
            key={s}
            active={!!filters.stone_type?.includes(s)}
            onClick={() => set({ stone_type: toggleIn<StoneType>(filters.stone_type, s) })}
          >
            {STONE_LABELS[s]}
          </Chip>
        ))}
      </Group>
      <Group title="Price">
        {PRICE_BANDS.map((b, i) => (
          <Chip
            key={b.label}
            active={activeBand === i}
            onClick={() =>
              set(
                activeBand === i
                  ? { min_price: undefined, max_price: undefined }
                  : { min_price: b.min, max_price: b.max },
              )
            }
          >
            {b.label}
          </Chip>
        ))}
      </Group>
      <Group title="For">
        {GENDERS.map((g) => (
          <Chip
            key={g.value}
            active={filters.gender === g.value}
            onClick={() => set({ gender: filters.gender === g.value ? undefined : g.value })}
          >
            {g.label}
          </Chip>
        ))}
      </Group>
      <Group title="Experience">
        <Chip
          active={!!filters.tryon_only}
          onClick={() => set({ tryon_only: !filters.tryon_only || undefined })}
        >
          Virtual try-on
        </Chip>
        <Chip
          active={!!filters.in_stock_only}
          onClick={() => set({ in_stock_only: !filters.in_stock_only || undefined })}
        >
          In stock
        </Chip>
      </Group>
    </div>
  );
}

export function countActiveFilters(f: ProductFilters): number {
  return [
    f.category,
    f.jewellery_type?.length,
    f.metal_type?.length,
    f.stone_type?.length,
    f.gender,
    f.min_price ?? f.max_price,
    f.tryon_only,
    f.in_stock_only,
    f.q,
  ].filter(Boolean).length;
}

export function FilterToolbar({
  filters,
  categories,
  onChange,
  total,
}: FilterPanelProps & { total?: number }) {
  const [open, setOpen] = useState(false);
  const active = countActiveFilters(filters);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="md"
          leftIcon={<SlidersHorizontal className="size-4" aria-hidden />}
          onClick={() => setOpen(true)}
          className="lg:hidden"
        >
          Filters{active ? ` (${active})` : ""}
        </Button>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange({ sort: filters.sort })}
            className="text-fg-muted hover:text-fg inline-flex min-h-11 items-center gap-1 text-sm"
          >
            <X className="size-4" aria-hidden /> Clear all
          </button>
        )}
        {typeof total === "number" && (
          <p className="text-fg-muted text-sm">{total === 1 ? "1 piece" : `${total} pieces`}</p>
        )}
      </div>
      <Select
        label={<span className="sr-only">Sort by</span>}
        wrapperClassName="w-52 gap-0"
        value={filters.sort ?? "relevance"}
        onChange={(e) => onChange({ ...filters, sort: e.target.value as ProductSort, page: 1 })}
        options={SORT_OPTIONS}
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filter jewellery"
        side="right"
        footer={
          <Button className="w-full" onClick={() => setOpen(false)}>
            Show results
          </Button>
        }
      >
        <FilterPanel filters={filters} categories={categories} onChange={onChange} />
      </Sheet>
    </div>
  );
}
