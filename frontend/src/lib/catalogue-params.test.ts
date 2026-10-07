import { filtersToSearch, parseProductFilters } from "./catalogue-params";

describe("catalogue params", () => {
  it("parses valid values and drops invalid ones", () => {
    const f = parseProductFilters({
      jewellery_type: "ring,unknown",
      metal_type: ["gold"],
      sort: "bogus",
      page: "3",
      min_price: "-5",
      gender: "women",
    });
    expect(f.jewellery_type).toEqual(["ring"]);
    expect(f.metal_type).toEqual(["gold"]);
    expect(f.sort).toBeUndefined();
    expect(f.page).toBe(3);
    expect(f.min_price).toBeUndefined();
    expect(f.gender).toBe("women");
  });

  it("round-trips filters to a compact query string", () => {
    expect(
      filtersToSearch({
        jewellery_type: ["ring", "bangle"],
        page: 1,
        sort: "newest",
        tryon_only: true,
      }),
    ).toBe("?jewellery_type=ring%2Cbangle&sort=newest&tryon_only=true");
  });
});
