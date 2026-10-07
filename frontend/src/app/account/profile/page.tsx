"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/api/hooks";
import { formatDate } from "@/lib/format";

export default function ProfilePage() {
  const router = useRouter();
  const session = useSession();
  useEffect(() => {
    if (session.data === null) router.replace("/account/login?next=/account/profile");
  }, [session.data, router]);

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="max-w-3xl">
        <Link
          href="/account"
          className="text-fg-muted hover:text-fg inline-flex min-h-10 items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden /> My account
        </Link>
        <h1 className="mt-3 text-4xl md:text-5xl">Profile &amp; photos</h1>
        {session.isPending || !session.data ? (
          <Skeleton className="mt-8 h-48 rounded-lg" />
        ) : (
          <dl className="border-border bg-bg-elevated mt-8 grid gap-4 rounded-lg border p-6 sm:grid-cols-2">
            {[
              ["Name", session.data.user.full_name],
              ["Email", session.data.user.email ?? "—"],
              ["Phone", session.data.user.phone ?? "—"],
              ["Member since", formatDate(session.data.user.created_at)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-fg-muted text-xs tracking-wider uppercase">{k}</dt>
                <dd className="mt-1">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <section className="border-border mt-8 rounded-lg border p-6">
          <h2 className="text-2xl">Your try-on photos</h2>
          <p className="text-fg-muted mt-2 text-sm">
            Photos you upload for try-on are private, kept for 30 days and can be deleted here at
            any time. Photo management appears once you’ve uploaded a photo in the try-on studio.
          </p>
          <Link
            href="/try-on"
            className="text-accent-text mt-4 inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
          >
            Open the try-on studio
          </Link>
        </section>
      </Container>
    </Section>
  );
}
