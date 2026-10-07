import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersTable } from "@/components/admin/customers";
import { TableSkeleton } from "@/components/admin/primitives";

export const metadata: Metadata = { title: "Customers" };

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CustomersTable />
    </Suspense>
  );
}
