import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/primitives";
import { AppointmentsQueue } from "@/components/admin/queues";

export const metadata: Metadata = { title: "Appointments" };

export default function AdminAppointmentsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <AppointmentsQueue />
    </Suspense>
  );
}
