"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import { useAdminOverview } from "@/lib/admin/hooks";
import type { ProductStat } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { BarChart, LineChart } from "./charts";
import { Card, PageHeader, QueryState, StatTile } from "./primitives";

const RANGES = [7, 30, 90] as const;

function ProductList({ title, items }: { title: string; items: ProductStat[] }) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-fg-muted text-sm">Nothing recorded in this range yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={item.product_id} className="flex items-center gap-3">
              <span className="text-fg-muted w-4 text-xs tabular-nums">{i + 1}</span>
              <span className="bg-bg-muted relative size-10 shrink-0 overflow-hidden rounded-sm">
                {item.image_url && (
                  <Image src={item.image_url} alt="" fill sizes="40px" className="object-cover" unoptimized />
                )}
              </span>
              <Link href={`/admin/products?q=${encodeURIComponent(item.name)}` as never} className="min-w-0 flex-1 truncate text-sm hover:underline">
                {item.name}
              </Link>
              <span className="font-semibold tabular-nums">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function Dashboard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const query = useAdminOverview(days);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What customers are trying, wanting and buying."
        actions={
          <div role="group" aria-label="Date range" className="border-border-strong flex rounded-sm border">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                className={cn(
                  "min-h-11 min-w-16 px-3 text-sm font-medium transition-colors",
                  days === r ? "bg-bg-inverse text-fg-inverse" : "text-fg-soft hover:bg-bg-muted",
                )}
              >
                {r} days
              </button>
            ))}
          </div>
        }
      />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="kpis">
              <StatTile label="Orders" value={query.data.totals.orders ?? 0} hint={`${query.data.totals.customers ?? 0} customers in total`} />
              <StatTile label="Revenue (paid)" value={formatPrice(query.data.revenue.paid)} hint={`${formatPrice(query.data.revenue.pending)} pending`} tone="gold" />
              <StatTile label="Try-ons" value={query.data.totals.tryons ?? 0} hint={`${query.data.totals.looks ?? 0} looks saved`} tone="emerald" />
              <StatTile label="Wishlist adds" value={query.data.totals.wishlist_adds ?? 0} />
              <StatTile label="Open enquiries" value={query.data.totals.open_enquiries ?? 0} hint={`${query.data.totals.enquiries ?? 0} new in range`} />
              <StatTile label="Pending appointments" value={query.data.totals.pending_appointments ?? 0} hint={`${query.data.totals.appointments ?? 0} booked in range`} />
              <StatTile label="Stylist queries" value={query.data.stylist_queries} />
              <StatTile label="Visual searches" value={query.data.visual_searches} hint={`${query.data.totals.new_customers ?? 0} new customers`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Try-ons per day">
                <BarChart data={query.data.tryons_per_day} label="Try-ons per day" />
              </Card>
              <Card title="Orders per day">
                <LineChart data={query.data.orders_per_day} label="Orders per day" />
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ProductList title="Most tried on" items={query.data.most_tried} />
              <ProductList title="Most viewed" items={query.data.most_viewed} />
              <ProductList title="Most wishlisted" items={query.data.most_wishlisted} />
              <ProductList title="Most shared" items={query.data.most_shared} />
              <ProductList title="Most enquired" items={query.data.most_enquired} />
              <ProductList title="Most purchased" items={query.data.most_purchased} />
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
