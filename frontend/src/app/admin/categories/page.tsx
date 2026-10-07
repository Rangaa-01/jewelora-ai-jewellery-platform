import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/catalogue-managers";
import { SectionGuard } from "@/components/admin/section-guard";

export const metadata: Metadata = { title: "Categories" };

export default function AdminCategoriesPage() {
  return (
    <SectionGuard section="categories">
      <CategoryManager />
    </SectionGuard>
  );
}
