"use client";

import { ChevronLeft, ChevronRight, LoaderCircle, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref as never}
            className="text-fg-muted hover:text-fg mb-2 inline-flex min-h-10 items-center gap-1 text-sm"
          >
            <ChevronLeft className="size-4" aria-hidden /> {backLabel ?? "Back"}
          </Link>
        )}
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {description && <p className="text-fg-muted mt-1 text-sm md:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("bg-bg-elevated border-border rounded-lg border shadow-sm", className)}>
      {(title || action) && (
        <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
          {title && <h2 className="font-sans text-sm font-semibold tracking-wide uppercase">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function StatTile({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "gold" | "emerald" }) {
  return (
    <div
      className={cn(
        "bg-bg-elevated border-border rounded-lg border p-4 shadow-sm",
        tone === "gold" && "border-gold/40 bg-gold/5",
        tone === "emerald" && "border-emerald/30 bg-emerald-soft/40",
      )}
    >
      <p className="text-fg-muted text-xs font-semibold tracking-[0.14em] uppercase">{label}</p>
      <p className="font-display mt-2 text-3xl leading-none">{value}</p>
      {hint && <p className="text-fg-muted mt-2 text-xs">{hint}</p>}
    </div>
  );
}

/** Renders loading / error / content for a TanStack query. */
export function QueryState({
  isPending,
  error,
  onRetry,
  skeleton,
  children,
}: {
  isPending: boolean;
  error: unknown;
  onRetry?: () => void;
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  if (isPending) return <>{skeleton ?? <TableSkeleton />}</>;
  if (error)
    return (
      <ErrorState compact description={errorMessage(error)} onRetry={onRetry} />
    );
  return <>{children}</>;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on narrow screens. */
  hideBelow?: "md" | "lg";
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  caption,
  empty,
  onRowClick,
  rowHref,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  caption: string;
  empty: ReactNode;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
}) {
  const router = useRouter();
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="border-border relative overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-bg-muted text-fg-muted text-left text-xs tracking-wider uppercase">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "px-3 py-2.5 font-semibold",
                  c.hideBelow === "md" && "hidden md:table-cell",
                  c.hideBelow === "lg" && "hidden lg:table-cell",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border bg-bg-elevated divide-y">
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={getKey(row)}
                onClick={
                  onRowClick
                    ? () => onRowClick(row)
                    : href
                      ? (event) => {
                          // Let real links/buttons inside the row handle their own clicks.
                          if ((event.target as HTMLElement).closest("a, button, input, select, label")) return;
                          router.push(href as never);
                        }
                      : undefined
                }
                className={cn((onRowClick || href) && "hover:bg-bg-muted/60 cursor-pointer")}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-3 align-middle",
                      c.hideBelow === "md" && "hidden md:table-cell",
                      c.hideBelow === "lg" && "hidden lg:table-cell",
                      c.className,
                    )}
                  >
                    {href && i === 0 ? (
                      <Link href={href as never} className="block min-h-6 rounded-xs outline-none focus-visible:underline">
                        {c.cell(row)}
                      </Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  if (pages <= 1) return <p className="text-fg-muted mt-3 text-xs">{total} total</p>;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-fg-muted text-xs">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button variant="outline" size="icon" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search", label = "Search" }: { value: string; onChange: (value: string) => void; placeholder?: string; label?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, 300);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <label className="relative block w-full md:max-w-xs">
      <span className="sr-only">{label}</span>
      <Search className="text-fg-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="border-border-strong bg-bg-elevated focus-visible:outline-ring min-h-11 w-full rounded-sm border py-2 pr-3 pl-9 text-sm"
      />
    </label>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      }
    />
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: "gold" | "emerald" | "neutral" | "rose" | "danger" | "inverse" }) {
  return <Badge tone={tone}>{label}</Badge>;
}

export function AccessDenied({ section }: { section?: string }) {
  return (
    <div role="alert" className="border-border bg-bg-elevated mx-auto mt-10 max-w-lg rounded-lg border p-8 text-center">
      <ShieldAlert className="text-accent-text mx-auto size-10" aria-hidden />
      <h1 className="mt-4 text-2xl">You don&apos;t have access to {section ?? "this area"}</h1>
      <p className="text-fg-muted mt-2 text-sm">
        Your staff role doesn&apos;t include this section. Ask a manager or administrator if you need it.
      </p>
      <ButtonLink href="/admin" variant="outline" className="mt-6">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}

export function InlineSpinner({ label = "Saving" }: { label?: string }) {
  return (
    <span className="text-fg-muted inline-flex items-center gap-2 text-xs" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden /> {label}
    </span>
  );
}

export function KeyValue({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-fg-muted text-xs tracking-wider uppercase">{item.label}</dt>
          <dd className="mt-0.5 break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
