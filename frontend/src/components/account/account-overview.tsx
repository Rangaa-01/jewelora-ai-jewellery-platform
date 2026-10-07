"use client";

import { Calendar, Heart, Images, LogOut, MessageCircle, Package, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useLogout, useSession } from "@/lib/api/hooks";

const SECTIONS = [
  { href: "/wishlist", icon: Heart, title: "Wishlist", text: "Pieces and looks you've saved." },
  {
    href: "/account/looks",
    icon: Images,
    title: "Saved looks",
    text: "Your try-on results and bridal looks.",
  },
  {
    href: "/account/appointments",
    icon: Calendar,
    title: "Appointments",
    text: "Upcoming and past showroom visits.",
  },
  {
    href: "/account/enquiries",
    icon: MessageCircle,
    title: "Enquiries",
    text: "Questions you've asked about jewellery.",
  },
  { href: "/account/orders", icon: Package, title: "Orders", text: "Purchases and reservations." },
  {
    href: "/account/profile",
    icon: UserRound,
    title: "Profile & photos",
    text: "Contact details, preferences and uploaded photos.",
  },
] as const;

export function AccountOverview() {
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();
  const { toast } = useToast();

  useEffect(() => {
    if (session.data === null) router.replace("/account/login?next=/account");
  }, [session.data, router]);

  if (session.isPending || session.data === null) {
    return (
      <Section aria-busy="true">
        <Container>
          <Skeleton className="h-10 w-64" />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </Container>
      </Section>
    );
  }
  if (session.error) {
    return (
      <Section>
        <Container className="max-w-xl text-center">
          <h1 className="text-4xl">Your account</h1>
          <p className="text-fg-muted mt-4">
            We couldn&apos;t check your session. Please try again.
          </p>
          <Button className="mt-6" onClick={() => void session.refetch()}>
            Try again
          </Button>
        </Container>
      </Section>
    );
  }
  const user = session.data.user;
  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">My account</p>
            <h1 className="text-4xl md:text-5xl">Hello, {user.full_name.split(" ")[0]}</h1>
            <p className="text-fg-muted mt-2 text-sm">{user.email ?? user.phone}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              leftIcon={<LogOut className="size-4" aria-hidden />}
              loading={logout.isPending}
              onClick={async () => {
                try {
                  await logout.mutateAsync();
                  router.push("/");
                } catch {
                  toast({
                    title: "Couldn't sign out",
                    description: "Please try again.",
                    tone: "error",
                  });
                }
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="border-border bg-bg-elevated flex h-full gap-4 rounded-lg border p-5 transition-shadow hover:shadow-md"
              >
                <span className="bg-gold/15 text-accent-text inline-flex size-11 shrink-0 items-center justify-center rounded-full">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{s.title}</span>
                  <span className="text-fg-muted mt-1 block text-sm">{s.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
