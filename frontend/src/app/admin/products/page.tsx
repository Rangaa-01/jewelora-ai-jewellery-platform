import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/primitives";
import { ProductsTable } from "@/components/admin/products";
import { SectionGuard } from "@/components/admin/section-guard";

export const metadata: Metadata = { title: "Products" };

export default function AdminProductsPage() {
  return (
    <SectionGuard section="products">
      <Suspense fallback={<TableSkeleton />}>
        <ProductsTable />
      </Suspense>
    </SectionGuard>
  );
}
