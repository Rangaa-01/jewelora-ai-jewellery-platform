import { lookShareUrl, whatsappShareUrl, wishlistShareUrl } from "./share";

describe("share url builders", () => {
  it("builds absolute look and wishlist links without double slashes", () => {
    expect(lookShareUrl("abc_-1", "https://jewelora.example/")).toBe(
      "https://jewelora.example/looks/abc_-1",
    );
    expect(wishlistShareUrl("t k", "https://jewelora.example")).toBe(
      "https://jewelora.example/wishlist/shared/t%20k",
    );
  });

  it("encodes the WhatsApp message", () => {
    const url = whatsappShareUrl("My bridal look ✨", "https://jewelora.example/looks/x");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe(
      "My bridal look ✨ https://jewelora.example/looks/x",
    );
  });
});
