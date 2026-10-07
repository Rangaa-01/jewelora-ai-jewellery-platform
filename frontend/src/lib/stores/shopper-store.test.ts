import { useShopperStore } from "./shopper-store";

describe("shopper store", () => {
  beforeEach(() => useShopperStore.setState({ recentlyViewed: [] }));

  it("keeps recently viewed unique and bounded", () => {
    const s = useShopperStore.getState();
    for (let i = 0; i < 15; i++) s.markViewed(`slug-${i % 13}`);
    const list = useShopperStore.getState().recentlyViewed;
    expect(list.length).toBeLessThanOrEqual(12);
    expect(new Set(list).size).toBe(list.length);
    expect(list[0]).toBe("slug-1");
  });
});
