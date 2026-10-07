"use client";

import { ArrowRight, Camera, Heart, MessageCircle, Sparkles, WandSparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useStylist } from "@/lib/api/hooks";
import type { StylistConstraints, StylistRecommendation } from "@/lib/api/types";
import { formatPriceCompact } from "@/lib/format";
import { useWishlistToggle } from "@/lib/shop/use-wishlist-toggle";

const EXAMPLES = [
  "I have a wedding next month. I want traditional gold jewellery under ₹2 lakh.",
  "Light diamond earrings for daily office wear, white gold, under ₹60,000.",
  "A statement emerald necklace for a sangeet, budget flexible.",
  "Rose gold bracelet and ring set as a 25th anniversary gift.",
];

const OCCASIONS = [
  { value: "", label: "Any occasion" },
  { value: "wedding", label: "Wedding" },
  { value: "engagement", label: "Engagement" },
  { value: "reception", label: "Reception / sangeet" },
  { value: "festive", label: "Festive" },
  { value: "everyday", label: "Everyday" },
  { value: "gifting", label: "Gifting" },
  { value: "anniversary", label: "Anniversary" },
];

function ConstraintChips({ c }: { c: StylistConstraints }) {
  const chips = [
    c.budget_max && `Up to ${formatPriceCompact(c.budget_max)}`,
    c.budget_min && `From ${formatPriceCompact(c.budget_min)}`,
    ...c.occasions,
    ...c.jewellery_types.map((t) => t.replace(/_/g, " ")),
    ...c.metal_types.map((m) => m.replace(/_/g, " ")),
    ...c.stone_types,
    ...c.styles,
    c.gender && `for ${c.gender}`,
  ].filter((x): x is string => !!x);
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What we understood">
      {chips.map((chip) => (
        <li key={chip}>
          <Badge tone="neutral">{chip}</Badge>
        </li>
      ))}
    </ul>
  );
}

function RecommendationCard({ r, index }: { r: StylistRecommendation; index: number }) {
  const { wishlisted, toggle, pending } = useWishlistToggle(r.product);
  return (
    <li className="border-border bg-bg-elevated grid gap-4 rounded-lg border p-4 sm:grid-cols-[7rem_1fr_auto]">
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
        <p className="text-fg-muted text-xs tracking-wider uppercase">Pick {index + 1}</p>
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
      <div className="flex flex-wrap gap-2 sm:flex-col">
        {r.product.tryon_enabled && (
          <ButtonLink
            href={`/try-on?product=${r.product.slug}`}
            size="sm"
            leftIcon={<Camera className="size-4" aria-hidden />}
          >
            Try On
          </ButtonLink>
        )}
        <Button
          size="sm"
          variant="outline"
          aria-pressed={wishlisted}
          loading={pending}
          onClick={() => toggle()}
          leftIcon={
            <Heart className={wishlisted ? "fill-gold text-gold size-4" : "size-4"} aria-hidden />
          }
        >
          {wishlisted ? "Saved" : "Wishlist"}
        </Button>
        <ButtonLink
          href={`/enquire?product=${r.product.slug}`}
          size="sm"
          variant="ghost"
          leftIcon={<MessageCircle className="size-4" aria-hidden />}
        >
          Enquire
        </ButtonLink>
      </div>
    </li>
  );
}

export function StylistView({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [budget, setBudget] = useState("");
  const [occasion, setOccasion] = useState("");
  const ask = useStylist();
  const ran = useRef(false);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setQ(t);
    window.history.replaceState(null, "", `/stylist?q=${encodeURIComponent(t)}`);
    ask.mutate({
      query: t,
      budget_max: budget ? Number(budget) : undefined,
      occasion: occasion || undefined,
    });
  };

  useEffect(() => {
    if (initialQuery && !ran.current) {
      ran.current = true;
      ask.mutate({ query: initialQuery });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the URL query
  }, [initialQuery]);

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
          className="border-border bg-bg-elevated mt-8 flex flex-col gap-3 rounded-lg border p-3 shadow-md"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
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
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Budget up to (₹)"
              type="number"
              inputMode="numeric"
              min={1000}
              step={1000}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              hint="Optional — overrides any amount in your description."
            />
            <Select
              label="Occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              options={OCCASIONS}
            />
          </div>
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
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl">
                    {ask.data.recommendations.length} pieces for “{ask.data.query}”
                  </h2>
                  {ask.data.llm_used && (
                    <Badge tone="gold">
                      <Sparkles className="size-3" aria-hidden /> AI-ranked
                    </Badge>
                  )}
                </div>
                <ConstraintChips c={ask.data.constraints} />
                {ask.data.note && (
                  <p className="border-gold/40 bg-gold/10 mt-4 rounded-sm border px-4 py-3 text-sm">
                    {ask.data.note}
                  </p>
                )}
                <ol className="mt-5 flex flex-col gap-4">
                  {ask.data.recommendations.map((r, i) => (
                    <RecommendationCard key={r.product.id} r={r} index={i} />
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
