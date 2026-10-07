"use client";

import { Images } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { usePublicLooks } from "@/lib/api/hooks";

export function CustomerLooks() {
  const query = usePublicLooks(6);
  const looks = query.data ?? [];
  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="Customer Looks"
          title="Looks our clients chose to share"
          description="Every look is created with Jewelora try-on and shared by its owner. Yours stays private unless you decide otherwise."
        />
        {query.isPending ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-md" />
            ))}
          </div>
        ) : looks.length === 0 ? (
          <EmptyState
            icon={Images}
            title="Be the first to share a look"
            description="Create a look in the try-on studio and share it to see it here."
            action={
              <ButtonLink href="/try-on" variant="outline">
                Create a look
              </ButtonLink>
            }
            compact
          />
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {looks.map((look) => (
              <li key={look.token}>
                <Link
                  href={`/looks/${look.token}`}
                  className="group bg-bg-muted block overflow-hidden rounded-md"
                >
                  <div className="relative aspect-[4/5]">
                    {look.preview_url ? (
                      <Image
                        src={look.preview_url}
                        alt={look.title}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-gold/60 flex size-full items-center justify-center">
                        <Images className="size-8" aria-hidden />
                      </div>
                    )}
                  </div>
                  <p className="p-3 text-sm font-medium">
                    {look.title}
                    <span className="text-fg-muted block text-xs font-normal">
                      {look.items.length} {look.items.length === 1 ? "piece" : "pieces"}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
