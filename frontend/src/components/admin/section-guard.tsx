"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/api/hooks";
import { canAccess, type AdminSection } from "@/lib/admin/nav";
import { AccessDenied } from "./primitives";

const SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: "the dashboard",
  products: "product management",
  categories: "categories",
  collections: "collections",
  stores: "stores",
  customers: "customers",
  orders: "orders",
  enquiries: "enquiries",
  appointments: "appointments",
  looks: "saved looks",
  staff: "staff management",
};

/** Hides a section from roles that can't use it (UX only; the API enforces access). */
export function SectionGuard({ section, children }: { section: AdminSection; children: ReactNode }) {
  const session = useSession();
  if (!session.data) return null;
  if (!canAccess(session.data.user.roles, section)) return <AccessDenied section={SECTION_LABELS[section]} />;
  return <>{children}</>;
}
