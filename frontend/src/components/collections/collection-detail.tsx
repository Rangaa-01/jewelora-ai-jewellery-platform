"use client";

import { Catalogue } from "@/components/catalogue/catalogue";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { useCollection } from "@/lib/api/hooks";
import { isApiError } from "@/lib/api/client";
import type { ProductFilters } from "@/lib/api/types";

export function CollectionDetail({
  slug,
  initialFilters,
}: {
  slug: string;
  initialFilters: ProductFilters;
}) {
  const query = useCollection(slug);
  if (query.isPending) {
    return (
      <Section padding="sm" className="pt-10 md:pt-16" aria-busy="true">
        <Container>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-12 w-80 max-w-full" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </Container>
      </Section>
    );
  }
  if (query.error) {
    const notFound = isApiError(query.error) && query.error.isNotFound;
    return (
      <Section>
        <Container className="max-w-xl">
          <ErrorState
            title={notFound ? "This collection isn't available" : "Collection didn't load"}
            description={
              notFound
                ? "It may have been renamed or retired. Explore our other collections instead."
                : undefined
            }
            onRetry={notFound ? undefined : () => void query.refetch()}
            action={
              <ButtonLink href="/collections" variant={notFound ? "primary" : "outline"}>
                All collections
              </ButtonLink>
            }
          />
        </Container>
      </Section>
    );
  }
  const c = query.data;
  return (
    <>
      <Section padding="sm" className="pt-10 md:pt-16" tone="muted">
        <Container>
          <p className="eyebrow mb-3">{c.is_bridal ? "Bridal collection" : "Collection"}</p>
          <h1 className="text-4xl md:text-6xl">{c.name}</h1>
          {c.tagline && <p className="font-display text-fg-soft mt-3 text-xl">{c.tagline}</p>}
          {c.description && <p className="text-fg-muted mt-4 max-w-2xl">{c.description}</p>}
        </Container>
      </Section>
      <Catalogue
        initialFilters={{ ...initialFilters, collection: c.slug }}
        lockedFilters={{ collection: c.slug }}
      />
    </>
  );
}
