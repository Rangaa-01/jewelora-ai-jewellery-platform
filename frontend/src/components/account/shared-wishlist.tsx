"use client";

import { Heart } from "lucide-react";
import { WishlistItems } from "./wishlist-view";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { isApiError } from "@/lib/api/client";
import { useSharedWishlist } from "@/lib/api/hooks";

export function SharedWishlistView({ token }: { token: string }) {
  const query = useSharedWishlist(token);
  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <p className="eyebrow mb-2">Shared wishlist</p>
        <h1 className="text-4xl md:text-5xl">{query.data?.name ?? "A Jewelora wishlist"}</h1>
        <p className="text-fg-muted mt-2 text-sm">
          Shared with you from Jewelora. Prices follow the day’s gold rate.
        </p>
        <div className="mt-8">
          {query.isPending ? (
            <Skeleton className="h-40 rounded-lg" aria-busy="true" />
          ) : query.error ? (
            isApiError(query.error) && query.error.status < 500 ? (
              <EmptyState
                icon={Heart}
                title="This wishlist isn't available"
                description="The link may have expired or the list was removed."
                action={<ButtonLink href="/products">Browse jewellery</ButtonLink>}
              />
            ) : (
              <ErrorState onRetry={() => void query.refetch()} />
            )
          ) : query.data.items.length === 0 ? (
            <EmptyState icon={Heart} title="This wishlist is empty" />
          ) : (
            <WishlistItems wishlist={query.data} readOnly />
          )}
        </div>
      </Container>
    </Section>
  );
}
