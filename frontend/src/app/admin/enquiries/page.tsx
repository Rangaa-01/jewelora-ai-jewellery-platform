import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/primitives";
import { EnquiriesQueue } from "@/components/admin/queues";

export const metadata: Metadata = { title: "Enquiries" };

export default function AdminEnquiriesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <EnquiriesQueue />
    </Suspense>
  );
}
