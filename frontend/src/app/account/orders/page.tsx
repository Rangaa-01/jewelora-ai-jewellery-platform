"use client";

import { Package } from "lucide-react";
import Link from "next/link";
import { AccountListPage } from "@/components/account/account-list-page";
import { ORDER_STATUS_LABELS, orderTone } from "@/components/orders/order-status";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/lib/api/types";
import { formatDate, formatPrice } from "@/lib/format";

export default function OrdersPage() {
  return (
    <AccountListPage<Order>
      title="Orders"
      description="Purchases and reservations placed with Jewelora."
      endpoint="/orders"
      queryKey="orders"
      icon={Package}
      emptyTitle="No orders yet"
      emptyDescription="Pieces you reserve or buy will appear here with their status."
      getKey={(o) => o.id}
      renderItem={(o) => (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/account/orders/${o.id}`}
              className="hover:text-accent-text font-semibold underline-offset-4 hover:underline"
            >
              Order {o.order_number}
            </Link>
            <p className="text-fg-muted text-sm">
              {o.items
                .map((i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`)
                .join(", ")}
            </p>
            <p className="text-fg-muted mt-1 text-xs">
              {formatDate(o.placed_at)} ·{" "}
              {o.fulfilment_method === "store_pickup"
                ? `Collect at ${o.store_name ?? "store"}`
                : "Home delivery"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatPrice(o.grand_total)}</p>
            <Badge tone={orderTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
          </div>
        </div>
      )}
    />
  );
}
