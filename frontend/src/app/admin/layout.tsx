import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Jewelora Admin" },
  robots: { index: false, follow: false },
};

/**
 * The admin area has its own chrome. The shop header/footer come from the root layout,
 * so they are hidden with a scoped style while an admin route is mounted.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <style>{`body > header, body > footer { display: none !important; }`}</style>
      <AdminShell>{children}</AdminShell>
    </>
  );
}
