import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useAddToCart, useCart, useWishlist } from "./hooks";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const cart = {
  id: "c1",
  items: [],
  subtotal: "0",
  tax_total: "0",
  grand_total: "0",
  currency: "INR",
  item_count: 0,
};

function mockFetch(routes: Record<string, (init?: RequestInit) => unknown>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return new Response(JSON.stringify({ error: { code: "not_found", message: "nope" } }), { status: 404 });
    const body = routes[key]!(init);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

describe("shop hooks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the guest cart and updates it after adding an item", async () => {
    const calls: string[] = [];
    mockFetch({
      "/auth/me": () => new Response(JSON.stringify({ error: { code: "unauthenticated", message: "" } }), { status: 401 }),
      "/cart": () => cart,
      "/cart/items": (init) => {
        calls.push(String(init?.body));
        return { ...cart, item_count: 2 };
      },
    });
    const { result } = renderHook(() => ({ cart: useCart(), add: useAddToCart() }), { wrapper });
    await waitFor(() => expect(result.current.cart.data?.item_count).toBe(0));
    await result.current.add.mutateAsync({ product_id: "p1", quantity: 2 });
    await waitFor(() => expect(result.current.cart.data?.item_count).toBe(2));
    expect(JSON.parse(calls[0]!)).toMatchObject({ product_id: "p1", quantity: 2 });
  });

  it("does not request the wishlist for guests", async () => {
    const fetchMock = mockFetch({
      "/auth/me": () => new Response(JSON.stringify({ error: { code: "unauthenticated", message: "" } }), { status: 401 }),
      "/wishlist": () => ({ id: "w", name: "x", items: [], share_token: null, share_url: null }),
    });
    const { result } = renderHook(() => useWishlist(), { wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).not.toContain("/api/v1/wishlist");
  });

  it("fetches the wishlist once signed in", async () => {
    mockFetch({
      "/auth/me": () => ({ user: { id: "u1", full_name: "Priya", email: "p@x.com", phone: null, roles: ["customer"], is_active: true, email_verified: false, phone_verified: false, created_at: "2026-01-01" }, access_expires_at: "2026-01-01" }),
      "/wishlist": () => ({ id: "w", name: "My wishlist", items: [{ id: "i1", product: null, variant_id: null, saved_look_id: null, note: null, created_at: "2026-01-01" }], share_token: null, share_url: null }),
    });
    const { result } = renderHook(() => useWishlist(), { wrapper });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
  });
});
