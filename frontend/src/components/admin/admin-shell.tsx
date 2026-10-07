"use client";

import { LogOut, Menu, Store, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout, useSession } from "@/lib/api/hooks";
import type { Role } from "@/lib/api/types";
import { activeSection, isStaff, visibleNav } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

function NavList({ roles, onNavigate }: { roles: readonly Role[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = activeSection(pathname);
  return (
    <ul className="flex flex-col gap-0.5">
      {visibleNav(roles).map((item) => {
        const active = current === item.section;
        return (
          <li key={item.section}>
            <Link
              href={item.href as never}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-fg-soft hover:bg-bg-muted hover:text-fg flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors",
                active && "bg-gold/15 text-fg",
              )}
            >
              <item.icon className={cn("size-4.5", active ? "text-accent-text" : "text-fg-muted")} aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrator", manager: "Manager", sales_staff: "Sales staff" };

export function AdminShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = session.data?.user;
  const staff = isStaff(user?.roles);

  useEffect(() => {
    if (session.data === null) {
      router.replace(`/account/login?next=${encodeURIComponent(pathname)}&reason=staff` as never);
    }
  }, [session.data, router, pathname]);

  if (session.isPending) {
    return (
      <div className="flex min-h-dvh" aria-busy="true">
        <aside className="border-border hidden w-64 border-r p-4 lg:block">
          <Skeleton className="h-8 w-32" />
          <div className="mt-8 flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </aside>
        <div className="flex-1 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mt-6 h-64" />
        </div>
      </div>
    );
  }

  if (!user || !staff) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div role="alert" className="border-border bg-bg-elevated max-w-md rounded-lg border p-8 text-center">
          <h1 className="text-2xl">Staff sign-in required</h1>
          <p className="text-fg-muted mt-2 text-sm">
            {user
              ? `You're signed in as ${user.full_name}, which is a customer account. The admin dashboard is for Jewelora staff.`
              : "Please sign in with your staff account to open the dashboard."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href={`/account/login?next=${encodeURIComponent(pathname)}&reason=staff` as never} className="text-accent-text underline-offset-4 hover:underline">
              {user ? "Switch account" : "Sign in"}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/" className="text-accent-text underline-offset-4 hover:underline">
              Back to the shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roles = user.roles;
  const roleLabel = roles.map((r) => ROLE_LABEL[r] ?? r).join(", ");

  const signOut = async () => {
    await logout.mutateAsync();
    router.push("/account/login");
  };

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border bg-bg-elevated hidden w-64 shrink-0 flex-col border-r lg:flex" aria-label="Admin">
        <div className="border-border flex h-16 items-center gap-2 border-b px-5">
          <span className="font-display text-xl tracking-wide">Jewelora</span>
          <span className="text-fg-muted text-[0.65rem] font-semibold tracking-[0.2em] uppercase">Admin</span>
        </div>
        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto p-3">
          <NavList roles={roles} />
        </nav>
        <div className="border-border border-t p-3">
          <Link href="/" className="text-fg-muted hover:text-fg flex min-h-10 items-center gap-2 px-3 text-sm">
            <Store className="size-4" aria-hidden /> View shop
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-bg-elevated/90 sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="touch-target text-fg-soft hover:bg-bg-muted -ml-2 inline-flex items-center justify-center rounded-sm lg:hidden"
              aria-label="Open admin menu"
            >
              <Menu className="size-6" aria-hidden />
            </button>
            <span className="font-display text-lg lg:hidden">Jewelora Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.full_name}</p>
              <p className="text-fg-muted text-xs">{roleLabel}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} loading={logout.isPending} leftIcon={<LogOut className="size-4" aria-hidden />}>
              Sign out
            </Button>
          </div>
        </header>
        <div className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Admin menu" side="left">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{user.full_name}</p>
            <p className="text-fg-muted text-xs">{roleLabel}</p>
          </div>
          <button type="button" className="sr-only" onClick={() => setMenuOpen(false)}>
            <X className="size-4" aria-hidden /> Close
          </button>
        </div>
        <nav aria-label="Admin sections">
          <NavList roles={roles} onNavigate={() => setMenuOpen(false)} />
        </nav>
      </Sheet>
    </div>
  );
}
