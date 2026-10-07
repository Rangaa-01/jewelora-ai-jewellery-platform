import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ProductViewerSlot } from "./product-viewer-slot";
import type { ProductDetail } from "@/lib/api/types";

vi.mock("@/components/viewer3d", () => ({
  JewelleryViewer: ({ variantId }: { variantId: string | null }) => (
    <div data-testid="viewer-mock">viewer:{variantId}</div>
  ),
  View3DButton: ({ onClick, active }: { onClick: () => void; active: boolean }) => (
    <button type="button" onClick={onClick} aria-pressed={active}>
      {active ? "3D view" : "View in 3D"}
    </button>
  ),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

function product(over: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "p1",
    sku: "SKU",
    slug: "ring",
    name: "Aurora Ring",
    short_description: null,
    category: {
      id: "c",
      name: "Rings",
      slug: "rings",
      description: null,
      parent_id: null,
      jewellery_type: "ring",
      image_url: null,
      sort_order: 0,
      is_active: true,
      product_count: 1,
    },
    jewellery_type: "ring",
    metal_type: "gold",
    purity: "18K",
    stone_type: "diamond",
    base_price: "100",
    discount_percent: "0",
    price: "100",
    currency: "INR",
    in_stock: true,
    is_made_to_order: false,
    tryon_enabled: false,
    has_3d: true,
    is_featured: false,
    is_new: false,
    gender: "women",
    occasions: [],
    tags: [],
    style: null,
    primary_image: null,
    hover_image: null,
    description: null,
    gross_weight_g: null,
    net_weight_g: null,
    stone_weight_ct: null,
    diamond_details: null,
    making_charges: "0",
    stock_quantity: 1,
    images: [
      {
        id: "i1",
        url: "/a.webp",
        alt_text: "front",
        view: "front",
        width: 10,
        height: 10,
        is_primary: true,
        variant_id: null,
      },
      {
        id: "i2",
        url: "/b.webp",
        alt_text: "angle",
        view: "angle",
        width: 10,
        height: 10,
        is_primary: false,
        variant_id: null,
      },
    ],
    variants: [],
    sizes: [],
    tryon_assets: [],
    model_3d_assets: [
      {
        id: "m1",
        url: "/m.glb",
        format: "glb",
        file_size_bytes: 10,
        scale: 1,
        material_overrides: null,
        variant_id: null,
        is_primary: true,
      },
    ],
    collections: [],
    set_items: [],
    is_active: true,
    ...over,
  } as ProductDetail;
}

describe("ProductViewerSlot", () => {
  it("shows photos by default and switches to the 3D viewer on request", () => {
    render(<ProductViewerSlot product={product()} variantId="v1" />);
    expect(screen.getByAltText("front")).toBeInTheDocument();
    expect(screen.queryByTestId("viewer-mock")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View in 3D" }));
    expect(screen.getByTestId("viewer-mock")).toHaveTextContent("viewer:v1");
    expect(screen.queryByRole("list", { name: "Product images" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Photos" }));
    expect(screen.queryByTestId("viewer-mock")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Product images" })).toBeInTheDocument();
  });

  it("never offers 3D when the product has no model", () => {
    render(
      <ProductViewerSlot
        product={product({ model_3d_assets: [], has_3d: false })}
        variantId={null}
      />,
    );
    expect(screen.queryByRole("button", { name: "View in 3D" })).not.toBeInTheDocument();
    expect(screen.getByAltText("front")).toBeInTheDocument();
  });
});
