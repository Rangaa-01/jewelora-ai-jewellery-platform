import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersTable } from "@/components/admin/orders";
import { TableSkeleton } from "@/components/admin/primitives";

export const metadata: Metadata = { title: "Orders" };

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <OrdersTable />
    </Suspense>
  );
}
