"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { CollectionCard } from "@/components/home/collections-grid";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useCategories, useCollections } from "@/lib/api/hooks";

export function CollectionsIndex({ bridalOnly }: { bridalOnly: boolean }) {
  const collections = useCollections();
  const categories = useCategories();
  const list = (collections.data ?? []).filter((c) => (bridalOnly ? c.is_bridal : true));

  return (
    <>
      <Section padding="sm" className="pt-10 md:pt-16">
        <Container>
          <SectionHeading
            as="h1"
            align="left"
            eyebrow={bridalOnly ? "Bridal" : "Collections"}
            title={bridalOnly ? "Bridal collections" : "Explore our collections"}
            description="Curated edits across occasions, metals and craft traditions. Every piece is available to try on, view in 3D where modelled, and reserve in store."
          />
          {collections.isPending ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
              ))}
            </div>
          ) : collections.error ? (
            <ErrorState
              title="Collections didn't load"
              onRetry={() => void collections.refetch()}
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={bridalOnly ? "No bridal collections yet" : "No collections yet"}
              description="The catalogue is still being arranged into collections. All jewellery is available to browse."
              action={<ButtonLink href="/products">Browse all jewellery</ButtonLink>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <CollectionCard key={c.id} collection={c} />
              ))}
            </div>
          )}
        </Container>
      </Section>
      <Section padding="sm" tone="muted">
        <Container>
          <SectionHeading align="left" eyebrow="Shop by category" title="Browse by type" />
          {categories.isPending ? (
            <div className="flex flex-wrap gap-3" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-32 rounded-full" />
              ))}
            </div>
          ) : (categories.data ?? []).length === 0 ? (
            <p className="text-fg-muted text-sm">
              Categories will appear once the catalogue is published.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {(categories.data ?? []).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/products?category=${c.slug}`}
                    className="border-border bg-bg hover:border-gold inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm"
                  >
                    {c.name}
                    {c.product_count > 0 && (
                      <span className="text-fg-muted">({c.product_count})</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>
    </>
  );
}
