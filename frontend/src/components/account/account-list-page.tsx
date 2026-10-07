"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { api, isApiError } from "@/lib/api/client";
import { useSession } from "@/lib/api/hooks";
import type { Page } from "@/lib/api/types";

interface AccountListPageProps<T> {
  title: string;
  description: string;
  endpoint: string;
  queryKey: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
}

/** Shared scaffold for the signed-in list pages (looks, appointments, enquiries, orders). */
export function AccountListPage<T>({
  title,
  description,
  endpoint,
  queryKey,
  icon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderItem,
  getKey,
}: AccountListPageProps<T>) {
  const router = useRouter();
  const session = useSession();
  useEffect(() => {
    if (session.data === null)
      router.replace(
        `/account/login?next=${encodeURIComponent(window.location.pathname)}` as never,
      );
  }, [session.data, router]);

  const query = useQuery({
    queryKey: ["account", queryKey],
    queryFn: async ({ signal }) => {
      const data = await api.get<Page<T> | T[]>(endpoint, { signal });
      return Array.isArray(data) ? data : data.items;
    },
    enabled: !!session.data,
    retry: false,
  });

  const unavailable = isApiError(query.error) && query.error.status === 404;

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="max-w-4xl">
        <Link
          href="/account"
          className="text-fg-muted hover:text-fg inline-flex min-h-10 items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden /> My account
        </Link>
        <h1 className="mt-3 text-4xl md:text-5xl">{title}</h1>
        <p className="text-fg-muted mt-2">{description}</p>
        <div className="mt-8">
          {session.isPending || query.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : query.error && !unavailable ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : !query.data || query.data.length === 0 || unavailable ? (
            <EmptyState
              icon={icon}
              title={emptyTitle}
              description={emptyDescription}
              action={
                emptyAction ?? (
                  <ButtonLink href="/products" variant="outline">
                    Browse jewellery
                  </ButtonLink>
                )
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {query.data.map((item) => (
                <li
                  key={getKey(item)}
                  className="border-border bg-bg-elevated rounded-lg border p-5"
                >
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}
