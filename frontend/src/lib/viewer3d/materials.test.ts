import type { Model3DAsset, ProductVariant } from "@/lib/api/types";
import {
  classifyMaterialName,
  gemPreset,
  metalOptions,
  metalPreset,
  pickModelForVariant,
  stoneFromMaterialName,
  stoneOptions,
} from "./materials";

function variant(over: Partial<ProductVariant>): ProductVariant {
  return {
    id: over.id ?? "v",
    sku_suffix: "X",
    metal_type: "gold",
    stone_type: "none",
    purity: "18K",
    price_delta: "0",
    price: "100",
    stock_quantity: 1,
    tint_hex: null,
    is_default: false,
    is_active: true,
    ...over,
  };
}

function model(over: Partial<Model3DAsset>): Model3DAsset {
  return {
    id: over.id ?? "m",
    url: over.url ?? "/m.glb",
    format: "glb",
    file_size_bytes: 1,
    scale: 1,
    material_overrides: null,
    variant_id: null,
    is_primary: false,
    ...over,
  };
}

describe("classifyMaterialName", () => {
  it("recognises the naming convention and leaves others alone", () => {
    expect(classifyMaterialName("gold_metal")).toBe("metal");
    expect(classifyMaterialName("Rose-Gold metal")).toBe("metal");
    expect(classifyMaterialName("ruby_gem")).toBe("gem");
    expect(classifyMaterialName("Leather strap")).toBe("other");
    expect(classifyMaterialName(undefined)).toBe("other");
    expect(classifyMaterialName("metallic_paint")).toBe("other");
  });
  it("extracts the stone kind from gem names", () => {
    expect(stoneFromMaterialName("ruby_gem")).toBe("ruby");
    expect(stoneFromMaterialName("diamond_gem")).toBe("diamond");
    expect(stoneFromMaterialName("mystery_gem")).toBeNull();
    expect(stoneFromMaterialName("gold_metal")).toBeNull();
  });
});

describe("presets", () => {
  it("uses the variant tint when valid, else the metal colour", () => {
    expect(metalPreset("gold", "#d69678").color).toBe("#d69678");
    expect(metalPreset("gold", "not-a-colour").color).toBe(metalPreset("gold").color);
    expect(metalPreset("gold").metalness).toBe(1);
  });
  it("gives clear stones transmission and opaque beads none", () => {
    expect(gemPreset("diamond").transmission).toBeGreaterThan(0.9);
    expect(gemPreset("pearl").transmission).toBe(0);
    expect(gemPreset(null).sparkle).toBe(false);
  });
});

describe("pickModelForVariant", () => {
  const assets = [
    model({ id: "primary", is_primary: true, variant_id: "wg" }),
    model({ id: "rose", variant_id: "rg" }),
    model({ id: "obj", format: "obj" }),
  ];
  it("prefers the variant's own model", () => {
    expect(pickModelForVariant(assets, "rg")?.id).toBe("rose");
  });
  it("falls back to the primary model and ignores non-GLB formats", () => {
    expect(pickModelForVariant(assets, "pt")?.id).toBe("primary");
    expect(pickModelForVariant(assets, null)?.id).toBe("primary");
    expect(pickModelForVariant([model({ format: "obj" })], null)).toBeNull();
  });
});

describe("switch options", () => {
  const variants = [
    variant({ id: "g-d", metal_type: "gold", stone_type: "diamond", is_default: true }),
    variant({ id: "wg-d", metal_type: "white_gold", stone_type: "diamond" }),
    variant({ id: "wg-s", metal_type: "white_gold", stone_type: "sapphire" }),
    variant({ id: "pt-d", metal_type: "platinum", stone_type: "diamond", is_active: false }),
  ];
  it("lists only metals that exist as active variants, keeping the current stone", () => {
    const opts = metalOptions(variants, "wg-s");
    expect(opts.map((o) => o.value)).toEqual(["gold", "white_gold"]);
    expect(opts.find((o) => o.value === "white_gold")?.variantId).toBe("wg-s");
  });
  it("lists stones only when the product has more than one, keeping the current metal", () => {
    const opts = stoneOptions(variants, "wg-d");
    expect(opts.map((o) => o.value)).toEqual(["diamond", "sapphire"]);
    expect(opts.find((o) => o.value === "diamond")?.variantId).toBe("wg-d");
    expect(stoneOptions([variants[0]!, variants[1]!], "g-d")).toEqual([]);
  });
});
