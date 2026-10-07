import { describe, expect, it } from "vitest";
import { activeSection, canAccess, isAdmin, isStaff, visibleNav } from "./nav";

describe("role-aware navigation", () => {
  it("shows sales staff only the queues", () => {
    const labels = visibleNav(["sales_staff"]).map((i) => i.label);
    expect(labels).toEqual(["Dashboard", "Orders", "Enquiries", "Appointments", "Customers", "Saved Looks"]);
    expect(labels).not.toContain("Products");
    expect(labels).not.toContain("Staff");
  });

  it("shows managers the catalogue but not staff management", () => {
    const labels = visibleNav(["manager"]).map((i) => i.label);
    expect(labels).toContain("Products");
    expect(labels).toContain("Stores");
    expect(labels).not.toContain("Staff");
  });

  it("shows admins everything", () => {
    expect(visibleNav(["admin"]).map((i) => i.label)).toContain("Staff");
    expect(isAdmin(["admin"])).toBe(true);
    expect(isAdmin(["manager"])).toBe(false);
  });

  it("hides everything from customers and anonymous users", () => {
    expect(visibleNav(["customer"])).toEqual([]);
    expect(visibleNav(undefined)).toEqual([]);
    expect(isStaff(["customer"])).toBe(false);
    expect(isStaff(["customer", "sales_staff"])).toBe(true);
    expect(canAccess(["customer"], "dashboard")).toBe(false);
  });

  it("resolves the active section from a pathname", () => {
    expect(activeSection("/admin")).toBe("dashboard");
    expect(activeSection("/admin/products/123?tab=assets".split("?")[0]!)).toBe("products");
    expect(activeSection("/admin/orders/abc")).toBe("orders");
    expect(activeSection("/account")).toBeNull();
  });
});
