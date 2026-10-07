import type { Metadata } from "next";
import { StoreManager } from "@/components/admin/catalogue-managers";
import { SectionGuard } from "@/components/admin/section-guard";

export const metadata: Metadata = { title: "Stores" };

export default function AdminStoresPage() {
  return (
    <SectionGuard section="stores">
      <StoreManager />
    </SectionGuard>
  );
}
