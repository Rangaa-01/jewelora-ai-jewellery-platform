import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarCheck,
  FolderTree,
  Gem,
  Layers,
  MessageSquareText,
  ShoppingBag,
  Sparkles,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/api/types";

export type StaffRole = Exclude<Role, "customer">;
export const STAFF_ROLES: readonly StaffRole[] = ["admin", "manager", "sales_staff"];

/** Which roles may open each admin section. Mirrors the backend dependencies; the API is authoritative. */
export const SECTION_ROLES = {
  dashboard: ["admin", "manager", "sales_staff"],
  products: ["admin", "manager"],
  categories: ["admin", "manager"],
  collections: ["admin", "manager"],
  stores: ["admin", "manager"],
  customers: ["admin", "manager", "sales_staff"],
  orders: ["admin", "manager", "sales_staff"],
  enquiries: ["admin", "manager", "sales_staff"],
  appointments: ["admin", "manager", "sales_staff"],
  looks: ["admin", "manager", "sales_staff"],
  staff: ["admin"],
} as const satisfies Record<string, readonly StaffRole[]>;

export type AdminSection = keyof typeof SECTION_ROLES;

export interface AdminNavItem {
  section: AdminSection;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { section: "dashboard", label: "Dashboard", href: "/admin", icon: BarChart3 },
  { section: "orders", label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { section: "enquiries", label: "Enquiries", href: "/admin/enquiries", icon: MessageSquareText },
  { section: "appointments", label: "Appointments", href: "/admin/appointments", icon: CalendarCheck },
  { section: "customers", label: "Customers", href: "/admin/customers", icon: Users },
  { section: "looks", label: "Saved Looks", href: "/admin/looks", icon: Sparkles },
  { section: "products", label: "Products", href: "/admin/products", icon: Gem },
  { section: "categories", label: "Categories", href: "/admin/categories", icon: FolderTree },
  { section: "collections", label: "Collections", href: "/admin/collections", icon: Layers },
  { section: "stores", label: "Stores", href: "/admin/stores", icon: Store },
  { section: "staff", label: "Staff", href: "/admin/staff", icon: UserCog },
];

export function isStaff(roles: readonly Role[] | undefined): boolean {
  return !!roles?.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}

export function canAccess(roles: readonly Role[] | undefined, section: AdminSection): boolean {
  if (!roles) return false;
  const allowed: readonly string[] = SECTION_ROLES[section];
  return roles.some((r) => allowed.includes(r));
}

/** Only products/customers management is manager+; sales staff can still update queues. */
export function canManageCatalogue(roles: readonly Role[] | undefined): boolean {
  return canAccess(roles, "products");
}

export function isAdmin(roles: readonly Role[] | undefined): boolean {
  return !!roles?.includes("admin");
}

export function visibleNav(roles: readonly Role[] | undefined): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => canAccess(roles, item.section));
}

/** The nav item that owns a pathname (longest matching href wins). */
export function activeSection(pathname: string): AdminSection | null {
  let best: AdminNavItem | null = null;
  for (const item of ADMIN_NAV) {
    const match = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.section ?? null;
}
