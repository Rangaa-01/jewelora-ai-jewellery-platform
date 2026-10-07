import type { Metadata } from "next";
import { Suspense } from "react";
import { LooksGallery } from "@/components/admin/looks-staff";
import { TableSkeleton } from "@/components/admin/primitives";

export const metadata: Metadata = { title: "Saved looks" };

export default function AdminLooksPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <LooksGallery />
    </Suspense>
  );
}
