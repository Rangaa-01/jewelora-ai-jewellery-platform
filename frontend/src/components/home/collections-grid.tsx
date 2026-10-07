"use client";

import { ArrowRight, Layers } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useCollections } from "@/lib/api/hooks";
import type { Collection } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function CollectionCard({
  collection,
  large = false,
}: {
  collection: Collection;
  large?: boolean;
}) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className={cn(
        "group bg-bg-inverse text-fg-inverse relative block overflow-hidden rounded-lg",
        large ? "aspect-[4/3] md:aspect-auto md:h-full md:min-h-[26rem]" : "aspect-[4/3]",
      )}
    >
      {collection.hero_image_url ? (
        <Image
          src={collection.hero_image_url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover opacity-80 transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-105"
        />
      ) : collection.preview_image_urls.length > 0 ? (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 grid gap-0.5 bg-[#efe9df]",
            collection.preview_image_urls.length >= 4
              ? "grid-cols-2 grid-rows-2"
              : collection.preview_image_urls.length >= 2
                ? "grid-cols-2"
                : "grid-cols-1",
          )}
        >
          {collection.preview_image_urls.slice(0, 4).map((url, index) => (
            <div key={url} className="relative overflow-hidden">
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className={cn(
                  "object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-105",
                  index > 0 && "opacity-95",
                )}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#3a3224,#1b1a17_70%)]"
        />
      )}
      <div
        aria-hidden
        className="from-ink/85 via-ink/20 absolute inset-0 bg-gradient-to-t to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-6">
        {collection.is_bridal && <p className="eyebrow !text-gold-bright mb-2">Bridal</p>}
        <h3 className="text-ivory text-2xl md:text-3xl">{collection.name}</h3>
        {collection.tagline && (
          <p className="text-ivory/75 mt-1 max-w-sm text-sm">{collection.tagline}</p>
        )}
        <span className="text-gold-bright mt-4 inline-flex items-center gap-1 text-sm">
          Explore{" "}
          {collection.product_count > 0 ? `${collection.product_count} pieces` : "collection"}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

export function CollectionsGrid() {
  const query = useCollections(true);
  const items = query.data ?? [];
  return (
    <Section tone="muted">
      <Container>
        <SectionHeading
          align="left"
          eyebrow="Explore Collections"
          title="Curated for every occasion"
          action={
            <ButtonLink
              href="/collections"
              variant="link"
              rightIcon={<ArrowRight className="size-4" aria-hidden />}
            >
              All collections
            </ButtonLink>
          }
        />
        {query.isPending ? (
          <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        ) : query.error ? (
          <ErrorState
            title="Collections didn't load"
            onRetry={() => void query.refetch()}
            compact
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Collections are being arranged"
            description="Our stylists are grouping the catalogue into collections. Browse all jewellery in the meantime."
            action={
              <ButtonLink href="/products" variant="outline">
                Browse all jewellery
              </ButtonLink>
            }
            compact
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 md:grid-rows-2">
            {items.slice(0, 5).map((c, i) => (
              <Reveal
                key={c.id}
                delay={i * 0.06}
                className={cn("h-full", i === 0 && "md:row-span-2")}
              >
                <CollectionCard collection={c} large={i === 0} />
              </Reveal>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
