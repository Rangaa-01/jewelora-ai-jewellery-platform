import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/primitives";
import { ProductEditor } from "@/components/admin/products";
import { SectionGuard } from "@/components/admin/section-guard";

export const metadata: Metadata = { title: "Edit product" };

export default async function AdminProductPage(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  return (
    <SectionGuard section="products">
      <Suspense fallback={<TableSkeleton />}>
        <ProductEditor id={id} />
      </Suspense>
    </SectionGuard>
  );
}
