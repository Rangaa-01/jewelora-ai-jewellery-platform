"use client";

import { useQueries } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/hooks";
import type { ProductDetail, ProductSummary } from "@/lib/api/types";
import { formatPrice, formatWeight } from "@/lib/format";
import { METAL_LABELS, STONE_LABELS } from "@/lib/labels";

/** Side-by-side comparison of up to four wishlist pieces. Weights come from the detail endpoint. */
export function WishlistCompare({
  products,
  onRemove,
}: {
  products: ProductSummary[];
  onRemove: (id: string) => void;
}) {
  const details = useQueries({
    queries: products.map((p) => ({
      queryKey: queryKeys.product(p.slug),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.get<ProductDetail>(`/products/${encodeURIComponent(p.slug)}`, { signal }),
      staleTime: 60_000,
    })),
  });
  if (products.length === 0) {
    return (
      <p className="text-fg-muted mt-6 text-sm">
        Tick “Compare” on up to four pieces to see them side by side.
      </p>
    );
  }
  const rows: Array<[string, (p: ProductSummary, d: ProductDetail | undefined) => string]> = [
    ["Price", (p) => formatPrice(p.price)],
    ["Metal", (p) => `${METAL_LABELS[p.metal_type]}${p.purity ? ` · ${p.purity}` : ""}`],
    ["Stones", (p) => (p.stone_type === "none" ? "None" : STONE_LABELS[p.stone_type])],
    ["Gross weight", (_, d) => formatWeight(d?.gross_weight_g) ?? "—"],
    ["Net weight", (_, d) => formatWeight(d?.net_weight_g) ?? "—"],
    ["Stone weight", (_, d) => (d?.stone_weight_ct ? `${Number(d.stone_weight_ct)} ct` : "—")],
    ["Try-on", (p) => (p.tryon_enabled ? "Yes" : "No")],
    [
      "Availability",
      (p) => (p.in_stock ? "In stock" : p.is_made_to_order ? "Made to order" : "Sold out"),
    ],
  ];
  return (
    <div className="mt-8 overflow-x-auto">
      <h2 className="mb-3 text-2xl">Compare</h2>
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="text-fg-muted p-2 text-left font-normal">
              Piece
            </th>
            {products.map((p) => (
              <th key={p.id} scope="col" className="p-2 text-left align-top">
                <Link href={`/products/${p.slug}`} className="hover:text-accent-text font-medium">
                  {p.name}
                </Link>
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  aria-label={`Remove ${p.name} from comparison`}
                  className="text-fg-muted hover:text-fg ml-2 inline-flex size-6 items-center justify-center align-middle"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, render]) => (
            <tr key={label} className="border-border border-t">
              <th scope="row" className="text-fg-muted p-2 text-left font-normal">
                {label}
              </th>
              {products.map((p, i) => (
                <td key={p.id} className="p-2">
                  {render(p, details[i]?.data)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
