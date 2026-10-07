import type { Metadata } from "next";
import { StaffForm } from "@/components/admin/looks-staff";
import { SectionGuard } from "@/components/admin/section-guard";

export const metadata: Metadata = { title: "Staff" };

export default function AdminStaffPage() {
  return (
    <SectionGuard section="staff">
      <StaffForm />
    </SectionGuard>
  );
}
