"use client";

import { ArrowRight } from "lucide-react";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { useProducts } from "@/lib/api/hooks";

export function FeaturedProducts() {
  const query = useProducts({ featured: true, page_size: 8 });
  return (
    <Section>
      <Container>
        <SectionHeading
          align="left"
          eyebrow="Featured Jewellery"
          title="Pieces our clients are trying on this week"
          action={
            <ButtonLink
              href="/products"
              variant="link"
              rightIcon={<ArrowRight className="size-4" aria-hidden />}
            >
              View all jewellery
            </ButtonLink>
          }
        />
        <ProductGrid
          products={query.data?.items}
          loading={query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyTitle="Featured pieces are being curated"
          emptyDescription="Browse the full catalogue while our stylists finish this week's selection."
          emptyAction={<ButtonLink href="/products">Browse all jewellery</ButtonLink>}
        />
      </Container>
    </Section>
  );
}
