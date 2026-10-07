"use client";

import { Package } from "lucide-react";
import { AccountListPage } from "@/components/account/account-list-page";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/lib/format";

interface Order {
  id: string;
  order_number: string;
  status: string;
  grand_total: string;
  placed_at: string;
  items: Array<{ name: string; quantity: number }>;
}

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
            <p className="font-semibold">Order {o.order_number}</p>
            <p className="text-fg-muted text-sm">
              {o.items
                .map((i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`)
                .join(", ")}
            </p>
            <p className="text-fg-muted mt-1 text-xs">{formatDate(o.placed_at)}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatPrice(o.grand_total)}</p>
            <Badge
              tone={
                o.status === "delivered" || o.status === "paid"
                  ? "emerald"
                  : o.status === "cancelled"
                    ? "danger"
                    : "gold"
              }
            >
              {o.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      )}
    />
  );
}
