"use client";

import { Gem } from "lucide-react";
import type { ReactNode } from "react";
import { ProductCard } from "./product-card";
import { ButtonLink } from "@/components/ui/button";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { ProductSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: ProductSummary[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
  skeletons?: number;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  columns?: "2-4" | "2-3";
  className?: string;
}

export function ProductGrid({
  products,
  loading,
  error,
  onRetry,
  skeletons = 8,
  emptyTitle = "No jewellery matches yet",
  emptyDescription = "Try widening your filters, or let our AI stylist suggest pieces for you.",
  emptyAction,
  columns = "2-4",
  className,
}: ProductGridProps) {
  const grid = cn(
    "grid gap-x-4 gap-y-8 sm:gap-x-6",
    columns === "2-4" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3",
    className,
  );
  if (loading) {
    return (
      <div className={grid} aria-busy="true" aria-label="Loading jewellery">
        {Array.from({ length: skeletons }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState title="We couldn't load the jewellery" onRetry={onRetry} />;
  if (!products || products.length === 0) {
    return (
      <EmptyState
        icon={Gem}
        title={emptyTitle}
        description={emptyDescription}
        action={
          emptyAction ?? (
            <ButtonLink href="/stylist" variant="outline">
              Ask the AI Stylist
            </ButtonLink>
          )
        }
      />
    );
  }
  return (
    <div className={grid}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
