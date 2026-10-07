"use client";

import { Heart, Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { SearchDialog } from "./search-dialog";
import { useSession } from "@/lib/api/hooks";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { selectCartCount, selectWishlistCount, useShopperStore } from "@/lib/stores/shopper-store";
import { useUiStore } from "@/lib/stores/ui-store";
import { NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

function IconLink({
  href,
  label,
  count,
  children,
}: {
  href: Route;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={count ? `${label} (${count})` : label}
      className="touch-target text-fg-soft hover:bg-bg-muted hover:text-fg relative inline-flex items-center justify-center rounded-sm transition-colors"
    >
      {children}
      {count ? (
        <span
          aria-hidden
          className="bg-gold text-ink absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[0.65rem] leading-4 font-bold"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const cartCount = useShopperStore(selectCartCount);
  const wishlistCount = useShopperStore(selectWishlistCount);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const { data: session } = useSession();
  const hydrated = useHydrated();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const frame = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const transparent = pathname === "/" && !scrolled;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-[background-color,box-shadow,border-color,height] duration-300",
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-border bg-bg/85 supports-[backdrop-filter]:bg-bg/75 border-b shadow-sm backdrop-blur-md",
      )}
    >
      <div
        className={cn(
          "container-x flex items-center justify-between gap-4 transition-[height] duration-300",
          scrolled ? "h-16" : "h-[var(--header-h)]",
        )}
      >
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="touch-target text-fg-soft hover:bg-bg-muted hover:text-fg -ml-2 inline-flex items-center justify-center rounded-sm"
            aria-label="Open menu"
          >
            <Menu className="size-6" aria-hidden />
          </button>
        </div>

        <Logo />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "text-fg-soft hover:text-fg relative inline-flex h-11 items-center px-3 text-[0.8rem] font-medium tracking-[0.14em] uppercase transition-colors",
                      "after:bg-gold after:absolute after:inset-x-3 after:bottom-2 after:h-px after:origin-left after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100",
                      active && "text-fg after:scale-x-100",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="touch-target text-fg-soft hover:bg-bg-muted hover:text-fg hidden items-center justify-center rounded-sm sm:inline-flex"
            aria-label="Search jewellery"
          >
            <Search className="size-5" aria-hidden />
          </button>
          <IconLink href="/wishlist" label="Wishlist" count={hydrated ? wishlistCount : 0}>
            <Heart className="size-5" aria-hidden />
          </IconLink>
          <IconLink
            href={session ? "/account" : "/account/login"}
            label={session ? "My account" : "Sign in"}
          >
            <UserRound className="size-5" aria-hidden />
          </IconLink>
          <IconLink href="/cart" label="Bag" count={hydrated ? cartCount : 0}>
            <ShoppingBag className="size-5" aria-hidden />
          </IconLink>
        </div>
      </div>
      <MobileNav />
      <SearchDialog />
    </header>
  );
}
