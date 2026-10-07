import {
  buildItemsPayload,
  debounce,
  makeLookItem,
  pickVariantId,
  slotOptionsFor,
} from "./session";
import type { ProductDetail, ProductSummary } from "@/lib/api/types";

const summary = (type: ProductSummary["jewellery_type"]): ProductSummary =>
  ({ id: `p-${type}`, slug: type, name: type, jewellery_type: type }) as unknown as ProductSummary;

describe("try-on session helpers", () => {
  it("builds the backend items payload with slots and adjustments", () => {
    const ring = makeLookItem(summary("ring"), "v1");
    expect(ring.slot).toBe("right_ring");
    const payload = buildItemsPayload([ring, makeLookItem(summary("necklace"))]);
    expect(payload[0]).toEqual({
      product_id: "p-ring",
      variant_id: "v1",
      size_id: null,
      slot: "right_ring",
      adjustments: { offset_x: 0, offset_y: 0, scale: 1, rotation_deg: 0 },
    });
    expect(payload[1]!.slot).toBeNull();
  });

  it("limits hand slots to detected hands", () => {
    const all = slotOptionsFor("ring");
    expect(all).toHaveLength(8);
    const leftOnly = slotOptionsFor("bangle", { hands: [{ handedness: "Left", score: 0.9 }] });
    expect(leftOnly.map((o) => o.value)).toEqual(["left_wrist"]);
    expect(slotOptionsFor("necklace")).toEqual([]);
  });

  it("falls back to the default variant", () => {
    const detail = {
      variants: [
        { id: "a", is_default: false },
        { id: "b", is_default: true },
      ],
    } as unknown as ProductDetail;
    expect(pickVariantId(detail, "zzz")).toBe("b");
    expect(pickVariantId(detail, "a")).toBe("a");
    expect(pickVariantId(undefined, "a")).toBeNull();
  });

  it("debounces with the latest arguments and can be cancelled", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
    d(3);
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
