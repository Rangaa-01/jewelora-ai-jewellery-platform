import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/primitives";
import { ProductForm } from "@/components/admin/product-form";
import { SectionGuard } from "@/components/admin/section-guard";

export const metadata: Metadata = { title: "New product" };

export default function AdminNewProductPage() {
  return (
    <SectionGuard section="products">
      <PageHeader backHref="/admin/products" backLabel="Products" title="New product" description="Save the details first; images, try-on cut-outs and 3D models are added on the next screen." />
      <ProductForm />
    </SectionGuard>
  );
}
