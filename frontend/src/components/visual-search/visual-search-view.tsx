"use client";

import { ScanSearch } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { FormError } from "@/components/forms/form-error";
import { ImageDropzone } from "@/components/forms/image-dropzone";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useVisualSearch } from "@/lib/api/hooks";
import type { VisualMatch } from "@/lib/api/types";

function MatchCard({ match, exact }: { match: VisualMatch; exact?: boolean }) {
  const p = match.product;
  return (
    <li className="flex flex-col">
      <Link
        href={`/products/${p.slug}`}
        className="bg-bg-muted relative block aspect-[4/5] overflow-hidden rounded-md"
      >
        {p.primary_image ? (
          <Image
            src={p.primary_image.url}
            alt={p.primary_image.alt_text || p.name}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <ProductImagePlaceholder />
        )}
        <span className="absolute top-2 left-2">
          <Badge tone={exact ? "emerald" : "neutral"}>
            {exact ? "Exact match" : `${Math.round(match.score * 100)}% similar`}
          </Badge>
        </span>
      </Link>
      <Link
        href={`/products/${p.slug}`}
        className="hover:text-accent-text mt-3 text-sm font-medium"
      >
        {p.name}
      </Link>
      <Price price={p.price} size="sm" className="mt-1" />
      <p className="text-fg-muted text-xs">
        {p.in_stock ? "In stock" : p.is_made_to_order ? "Made to order" : "Currently sold out"}
      </p>
      <div className="mt-2 flex gap-2">
        {p.tryon_enabled && (
          <ButtonLink href={`/try-on?product=${p.slug}`} size="sm" variant="outline">
            Try on
          </ButtonLink>
        )}
      </div>
    </li>
  );
}

export function VisualSearchView() {
  const [file, setFile] = useState<File | null>(null);
  const search = useVisualSearch();

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <p className="eyebrow mb-2 inline-flex items-center gap-2">
          <ScanSearch className="size-4" aria-hidden /> Visual Search
        </p>
        <h1 className="text-4xl md:text-5xl">Find jewellery from a picture</h1>
        <p className="text-fg-muted mt-3 max-w-2xl">
          Upload a screenshot, catalogue photo or a picture of a piece you own. We compare it with
          our catalogue and show exact and similar matches with current prices.
        </p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[22rem_1fr]">
          <div className="flex flex-col gap-4">
            <ImageDropzone
              file={file}
              onChange={(f) => {
                setFile(f);
                search.reset();
              }}
              label="Upload a jewellery image"
              hint="JPEG, PNG or WebP up to 12 MB. Crop to the jewellery for best results."
              capture="environment"
            />
            <FormError error={search.error} />
            <Button
              size="lg"
              onClick={() => file && search.mutate(file)}
              disabled={!file}
              loading={search.isPending}
              leftIcon={<ScanSearch className="size-5" aria-hidden />}
            >
              Search the catalogue
            </Button>
          </div>
          <div aria-live="polite">
            {search.isPending ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i}>
                    <ProductCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : search.data ? (
              search.data.indexed_products === 0 ? (
                <EmptyState
                  icon={ScanSearch}
                  title="Visual search isn't ready yet"
                  description="The shop hasn't indexed its product photos for visual search. Try the AI stylist or browse the catalogue instead."
                  action={
                    <ButtonLink href="/stylist" variant="outline">
                      Ask the AI Stylist
                    </ButtonLink>
                  }
                />
              ) : !search.data.exact && search.data.similar.length === 0 ? (
                <EmptyState
                  icon={ScanSearch}
                  title="No close matches"
                  description="We couldn't find similar pieces. Try a clearer, closer photo of the jewellery, or ask the AI stylist."
                  action={
                    <ButtonLink href="/stylist" variant="outline">
                      Ask the AI Stylist
                    </ButtonLink>
                  }
                />
              ) : (
                <>
                  {search.data.exact && (
                    <p className="border-emerald/40 bg-emerald-soft text-emerald-deep mb-4 rounded-sm border px-4 py-2 text-sm">
                      We found an exact match in our catalogue — shown first.
                    </p>
                  )}
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3">
                    {search.data.exact && <MatchCard match={search.data.exact} exact />}
                    {search.data.similar.map((m) => (
                      <MatchCard key={m.product.id} match={m} />
                    ))}
                  </ul>
                  <p className="text-fg-muted mt-6 text-xs">
                    Compared against {search.data.indexed_products} indexed pieces.
                  </p>
                </>
              )
            ) : (
              <div className="border-border-strong text-fg-muted flex min-h-64 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm">
                Matches appear here after you search.
              </div>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
