import type { Metadata } from "next";
import { CollectionManager } from "@/components/admin/catalogue-managers";
import { SectionGuard } from "@/components/admin/section-guard";

export const metadata: Metadata = { title: "Collections" };

export default function AdminCollectionsPage() {
  return (
    <SectionGuard section="collections">
      <CollectionManager />
    </SectionGuard>
  );
}
