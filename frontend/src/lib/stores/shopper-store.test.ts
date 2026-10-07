import { cartItemKey, selectCartCount, useShopperStore } from "./shopper-store";

const item = {
  productId: "p1",
  slug: "ring",
  name: "Ring",
  price: "1000",
  imageUrl: null,
  variantId: null,
  variantLabel: null,
  sizeId: null,
  sizeLabel: null,
};

describe("shopper store", () => {
  beforeEach(() => useShopperStore.setState({ cart: [], wishlist: [], recentlyViewed: [] }));

  it("adds, merges and removes cart items", () => {
    const s = useShopperStore.getState();
    s.addToCart(item);
    s.addToCart(item, 2);
    expect(selectCartCount(useShopperStore.getState())).toBe(3);
    s.updateCartQuantity(cartItemKey(item), 0);
    expect(useShopperStore.getState().cart).toHaveLength(0);
  });

  it("toggles wishlist membership", () => {
    const s = useShopperStore.getState();
    expect(
      s.toggleWishlist({
        productId: "p1",
        slug: "ring",
        name: "Ring",
        price: "1000",
        imageUrl: null,
      }),
    ).toBe(true);
    expect(useShopperStore.getState().isWishlisted("p1")).toBe(true);
    expect(
      useShopperStore
        .getState()
        .toggleWishlist({
          productId: "p1",
          slug: "ring",
          name: "Ring",
          price: "1000",
          imageUrl: null,
        }),
    ).toBe(false);
  });

  it("keeps recently viewed unique and bounded", () => {
    const s = useShopperStore.getState();
    for (let i = 0; i < 15; i++) s.markViewed(`slug-${i % 13}`);
    const list = useShopperStore.getState().recentlyViewed;
    expect(list.length).toBeLessThanOrEqual(12);
    expect(new Set(list).size).toBe(list.length);
  });
});
