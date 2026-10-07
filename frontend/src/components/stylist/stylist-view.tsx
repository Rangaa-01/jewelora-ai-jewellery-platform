"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Camera, WandSparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { api } from "@/lib/api/client";
import type { ProductSummary } from "@/lib/api/types";

interface Recommendation {
  product: ProductSummary;
  reason: string;
  score?: number;
}
interface StylistResponse {
  query: string;
  constraints: Record<string, unknown>;
  recommendations: Recommendation[];
  note?: string | null;
}

const EXAMPLES = [
  "I have a wedding next month. I want traditional gold jewellery under ₹2 lakh.",
  "Light diamond earrings for daily office wear, white gold, under ₹60,000.",
  "A statement emerald necklace for a sangeet, budget flexible.",
  "Rose gold bracelet and ring set as a 25th anniversary gift.",
];

export function StylistView({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const ask = useMutation({
    mutationFn: (query: string) => api.post<StylistResponse>("/stylist/recommend", { query }),
  });

  useEffect(() => {
    if (initialQuery) ask.mutate(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the URL query
  }, [initialQuery]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setQ(t);
    window.history.replaceState(null, "", `/stylist?q=${encodeURIComponent(t)}`);
    ask.mutate(t);
  };

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="max-w-5xl">
        <p className="eyebrow mb-2 inline-flex items-center gap-2">
          <WandSparkles className="size-4" aria-hidden /> AI Stylist
        </p>
        <h1 className="text-4xl md:text-5xl">Tell us about the occasion</h1>
        <p className="text-fg-muted mt-3 max-w-2xl">
          Describe the event, your outfit, metal and stone preferences and your budget.
          Recommendations come only from pieces in our catalogue, with a reason for each.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
          className="border-border bg-bg-elevated mt-8 flex flex-col gap-3 rounded-lg border p-3 shadow-md sm:flex-row"
        >
          <label htmlFor="stylist-query" className="sr-only">
            What are you looking for?
          </label>
          <textarea
            id="stylist-query"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="I have a wedding next month and want…"
            className="placeholder:text-fg-muted/70 focus-visible:outline-ring min-h-12 flex-1 resize-none rounded-sm bg-transparent px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-0"
          />
          <Button
            type="submit"
            size="lg"
            loading={ask.isPending}
            disabled={!q.trim()}
            rightIcon={<ArrowRight className="size-4" aria-hidden />}
          >
            Get recommendations
          </Button>
        </form>
        {!ask.data && !ask.isPending && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button
                  type="button"
                  onClick={() => submit(ex)}
                  className="border-border text-fg-soft hover:border-gold hover:text-fg inline-flex min-h-10 items-center rounded-full border px-4 text-left text-sm"
                >
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10" aria-live="polite">
          {ask.isPending ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-5 w-64" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-lg" />
              ))}
            </div>
          ) : ask.error ? (
            <FormError error={ask.error} />
          ) : ask.data ? (
            ask.data.recommendations.length === 0 ? (
              <EmptyState
                icon={WandSparkles}
                title="Nothing in the catalogue fits that brief yet"
                description={
                  ask.data.note ??
                  "Try widening the budget or occasion, or browse the full collection."
                }
                action={
                  <ButtonLink href="/products" variant="outline">
                    Browse jewellery
                  </ButtonLink>
                }
              />
            ) : (
              <>
                <h2 className="mb-5 text-2xl">
                  {ask.data.recommendations.length} pieces for “{ask.data.query}”
                </h2>
                {ask.data.note && <p className="text-fg-muted mb-5 text-sm">{ask.data.note}</p>}
                <ol className="flex flex-col gap-4">
                  {ask.data.recommendations.map((r, i) => (
                    <li
                      key={r.product.id}
                      className="border-border bg-bg-elevated grid gap-4 rounded-lg border p-4 sm:grid-cols-[7rem_1fr_auto]"
                    >
                      <Link
                        href={`/products/${r.product.slug}`}
                        className="bg-bg-muted relative aspect-square overflow-hidden rounded-md"
                      >
                        {r.product.primary_image ? (
                          <Image
                            src={r.product.primary_image.url}
                            alt=""
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        ) : (
                          <ProductImagePlaceholder />
                        )}
                      </Link>
                      <div>
                        <p className="text-fg-muted text-xs tracking-wider uppercase">
                          Pick {i + 1}
                        </p>
                        <Link
                          href={`/products/${r.product.slug}`}
                          className="font-display hover:text-accent-text text-xl"
                        >
                          {r.product.name}
                        </Link>
                        <Price
                          price={r.product.price}
                          basePrice={r.product.base_price}
                          discountPercent={r.product.discount_percent}
                          size="sm"
                          className="mt-1"
                        />
                        <p className="text-fg-soft mt-2 text-sm">{r.reason}</p>
                      </div>
                      <div className="flex gap-2 sm:flex-col">
                        {r.product.tryon_enabled && (
                          <ButtonLink
                            href={`/try-on?product=${r.product.slug}`}
                            size="sm"
                            leftIcon={<Camera className="size-4" aria-hidden />}
                          >
                            Try On
                          </ButtonLink>
                        )}
                        <ButtonLink
                          href={`/products/${r.product.slug}`}
                          size="sm"
                          variant="outline"
                        >
                          View
                        </ButtonLink>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
