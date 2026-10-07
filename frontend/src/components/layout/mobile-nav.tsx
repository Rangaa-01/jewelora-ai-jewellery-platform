"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/dialog";
import { ButtonLink } from "@/components/ui/button";
import { useSession } from "@/lib/api/hooks";
import { useUiStore } from "@/lib/stores/ui-store";
import { NAV_LINKS, SITE } from "@/lib/site";

export function MobileNav() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data: session } = useSession();

  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Menu" side="left" hideTitle>
      <nav aria-label="Mobile" className="flex h-full flex-col">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            router.push(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : "/products");
          }}
          className="relative mb-4"
        >
          <Search
            className="text-fg-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search jewellery"
            aria-label="Search jewellery"
            className="border-border-strong bg-bg-elevated focus-visible:border-fg focus-visible:outline-ring h-11 w-full rounded-sm border pr-3 pl-9 text-base focus-visible:outline-2 focus-visible:outline-offset-0"
          />
        </form>
        <ul className="flex flex-col">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="border-border font-display text-fg hover:text-accent-text flex min-h-14 items-center justify-between border-b text-2xl"
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
                <ArrowRight className="text-fg-muted size-5" aria-hidden />
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/products"
              className="border-border font-display text-fg hover:text-accent-text flex min-h-14 items-center justify-between border-b text-2xl"
            >
              All Jewellery
              <ArrowRight className="text-fg-muted size-5" aria-hidden />
            </Link>
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3">
          <ButtonLink href="/try-on" size="lg">
            Try It On
          </ButtonLink>
          <ButtonLink href={session ? "/account" : "/account/login"} variant="outline" size="lg">
            {session ? `Hi, ${session.user.full_name.split(" ")[0]}` : "Sign in"}
          </ButtonLink>
        </div>
        <p className="text-fg-muted mt-auto pt-8 text-sm">
          Questions? Call{" "}
          <a
            href={`tel:${SITE.phone.replace(/\s/g, "")}`}
            className="text-accent-text underline-offset-4 hover:underline"
          >
            {SITE.phone}
          </a>
        </p>
      </nav>
    </Sheet>
  );
}
