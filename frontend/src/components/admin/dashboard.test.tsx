import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AnalyticsOverview } from "@/lib/api/types";
import { Dashboard } from "./dashboard";

const overview: AnalyticsOverview = {
  range_days: 30,
  totals: { customers: 12, new_customers: 3, products: 28, orders: 4, appointments: 2, enquiries: 5, open_enquiries: 2, pending_appointments: 1, tryons: 40, looks: 6, wishlist_adds: 9 },
  revenue: { paid: "250000.00", pending: "12000.00" },
  most_tried: [{ product_id: "p1", name: "Lakshmi Temple Necklace", slug: "lakshmi", image_url: null, count: 12 }],
  most_viewed: [],
  most_wishlisted: [],
  most_shared: [],
  most_enquired: [],
  most_purchased: [],
  tryons_per_day: [{ date: "2026-10-01", count: 3 }, { date: "2026-10-02", count: 5 }],
  orders_per_day: [],
  stylist_queries: 7,
  visual_searches: 2,
};

const get = vi.fn();
vi.mock("@/lib/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...original, api: { ...original.api, get: (...args: unknown[]) => get(...args) } };
});

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

describe("Dashboard", () => {
  it("renders KPIs, charts and product lists from the overview", async () => {
    get.mockResolvedValue(overview);
    renderDashboard();
    expect(await screen.findByText("Lakshmi Temple Necklace")).toBeInTheDocument();
    expect(screen.getByText("₹2,50,000")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Try-ons per day/ })).toBeInTheDocument();
    expect(screen.getByText(/No orders per day in this range yet/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/admin/analytics/overview?days=30", expect.anything());
  });

  it("refetches when the range changes", async () => {
    get.mockResolvedValue(overview);
    renderDashboard();
    await screen.findByText("Lakshmi Temple Necklace");
    await userEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(get).toHaveBeenCalledWith("/admin/analytics/overview?days=7", expect.anything());
    expect(screen.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a retryable error state when the API fails", async () => {
    const { ApiError } = await import("@/lib/api/client");
    get.mockRejectedValue(new ApiError(500, "internal_error", "Something went wrong on our side. Please try again."));
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Something went wrong/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
