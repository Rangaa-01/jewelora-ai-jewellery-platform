"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FilterPanel, FilterToolbar } from "./filters";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-grid";
import { Container, Section } from "@/components/ui/layout";
import { useCategories, useProducts } from "@/lib/api/hooks";
import type { ProductFilters } from "@/lib/api/types";
import { filtersToSearch } from "@/lib/catalogue-params";

interface CatalogueProps {
  initialFilters: ProductFilters;
  /** Filters fixed by the page (e.g. a collection) that the user cannot change. */
  lockedFilters?: Partial<ProductFilters>;
  title?: string;
}

const PAGE_SIZE = 24;

export function Catalogue({ initialFilters, lockedFilters = {}, title }: CatalogueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<ProductFilters>({ ...initialFilters, ...lockedFilters });
  // Re-sync local state when the URL-derived filters change (back/forward navigation).
  const urlKey = JSON.stringify(initialFilters);
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setFilters({ ...initialFilters, ...lockedFilters });
  }

  const products = useProducts({ ...filters, page_size: PAGE_SIZE });
  const categories = useCategories();

  const update = (next: ProductFilters) => {
    const merged = { ...next, ...lockedFilters };
    setFilters(merged);
    const { collection: _collection, ...urlFilters } = merged;
    void _collection;
    router.replace(
      `${pathname}${filtersToSearch(lockedFilters.collection ? urlFilters : merged)}` as never,
      { scroll: false },
    );
  };

  const onPage = (page: number) => {
    update({ ...filters, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Section padding="sm">
      <Container>
        {title && (
          <h1 className="mb-6 text-4xl md:text-5xl">
            {title}
            {filters.q && (
              <span className="text-fg-muted block text-xl">Results for “{filters.q}”</span>
            )}
          </h1>
        )}
        <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
              <FilterPanel filters={filters} categories={categories.data ?? []} onChange={update} />
            </div>
          </aside>
          <div>
            <FilterToolbar
              filters={filters}
              categories={categories.data ?? []}
              onChange={update}
              total={products.data?.total}
            />
            <div className="mt-6">
              <ProductGrid
                products={products.data?.items}
                loading={products.isPending}
                error={products.error}
                onRetry={() => void products.refetch()}
                columns="2-3"
                skeletons={9}
              />
            </div>
            {products.data && (
              <Pagination
                page={products.data.page}
                pages={products.data.pages}
                onPageChange={onPage}
              />
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
