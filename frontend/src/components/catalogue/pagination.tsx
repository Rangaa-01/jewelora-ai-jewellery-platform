"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

function range(page: number, pages: number): Array<number | "…"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>(
    [1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages),
  );
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && current - prev > 1) out.push("…");
    out.push(current);
  }
  return out;
}

export function Pagination({ page, pages, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;
  const btn =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border text-sm transition-colors";
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1">
      <button
        type="button"
        className={cn(btn, "border-border hover:border-fg disabled:opacity-40")}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      {range(page, pages).map((item, i) =>
        item === "…" ? (
          <span key={`gap-${i}`} className="text-fg-muted px-2" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              btn,
              item === page ? "border-gold-deep bg-gold text-ink" : "border-border hover:border-fg",
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(btn, "border-border hover:border-fg disabled:opacity-40")}
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
