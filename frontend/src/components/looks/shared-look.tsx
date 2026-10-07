"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, Camera, Images } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { api, isApiError } from "@/lib/api/client";
import type { ProductSummary } from "@/lib/api/types";

interface SharedLook {
  id: string;
  title: string;
  kind: string;
  preview_url: string | null;
  created_at: string;
  items: Array<{ slot: string; product: ProductSummary }>;
}

export function SharedLookView({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["looks", "shared", token],
    queryFn: () => api.get<SharedLook>(`/looks/shared/${encodeURIComponent(token)}`),
    retry: false,
  });

  if (query.isPending) {
    return (
      <Section aria-busy="true">
        <Container className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-[4/5] rounded-lg" />
          <div>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="mt-6 h-40" />
          </div>
        </Container>
      </Section>
    );
  }
  if (query.error || !query.data) {
    const gone = isApiError(query.error) && query.error.status < 500;
    return (
      <Section>
        <Container className="max-w-xl">
          <EmptyState
            icon={Images}
            title={gone ? "This look isn't available" : "Couldn't load this look"}
            description={
              gone
                ? "The owner may have made it private or the link has expired."
                : "Please try again in a moment."
            }
            action={<ButtonLink href="/try-on">Create your own look</ButtonLink>}
          />
        </Container>
      </Section>
    );
  }
  const look = query.data;
  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="grid gap-10 lg:grid-cols-2">
        <div className="bg-bg-muted relative aspect-[4/5] overflow-hidden rounded-lg">
          {look.preview_url ? (
            <Image
              src={look.preview_url}
              alt={look.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              preload
            />
          ) : (
            <div className="text-gold/60 flex size-full items-center justify-center">
              <Images className="size-10" aria-hidden />
            </div>
          )}
        </div>
        <div>
          <p className="eyebrow mb-2">
            {look.kind === "bridal" ? "Shared bridal look" : "Shared look"}
          </p>
          <h1 className="text-4xl md:text-5xl">{look.title}</h1>
          <ul className="mt-8 flex flex-col gap-3">
            {look.items.map((it) => (
              <li
                key={it.product.id}
                className="border-border bg-bg-elevated flex items-center gap-4 rounded-lg border p-3"
              >
                <div className="bg-bg-muted relative size-16 shrink-0 overflow-hidden rounded-md">
                  {it.product.primary_image && (
                    <Image
                      src={it.product.primary_image.url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${it.product.slug}`}
                    className="hover:text-accent-text font-medium"
                  >
                    {it.product.name}
                  </Link>
                  <Price price={it.product.price} size="sm" className="mt-0.5" />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink
              href={`/try-on?products=${look.items.map((i) => i.product.slug).join(",")}`}
              leftIcon={<Camera className="size-4" aria-hidden />}
            >
              Try this look on me
            </ButtonLink>
            <ButtonLink
              href={`/appointments/new?look=${token}`}
              variant="outline"
              leftIcon={<Calendar className="size-4" aria-hidden />}
            >
              Book a visit
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
