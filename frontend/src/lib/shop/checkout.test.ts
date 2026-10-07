import { EMPTY_CHECKOUT, firstIncompleteStep, toOrderPayload, validateStep } from "./checkout";

const filled = {
  ...EMPTY_CHECKOUT,
  contact_name: "Priya Raman",
  contact_phone: "+91 98765 43210",
  store_id: "store-1",
};

describe("checkout validation", () => {
  it("requires contact details", () => {
    expect(validateStep("contact", EMPTY_CHECKOUT)).toMatchObject({
      contact_name: expect.any(String),
      contact_phone: expect.any(String),
    });
    expect(
      validateStep("contact", { ...filled, contact_email: "nope" }).contact_email,
    ).toBeTruthy();
    expect(validateStep("contact", filled)).toEqual({});
  });

  it("requires a store for pickup and an address for delivery", () => {
    expect(validateStep("fulfilment", { ...filled, store_id: "" })).toEqual({
      store_id: "Choose a store",
    });
    const delivery = { ...filled, fulfilment_method: "delivery" as const };
    expect(Object.keys(validateStep("fulfilment", delivery)).sort()).toEqual([
      "address_line1",
      "city",
      "postal_code",
      "state",
    ]);
    expect(
      validateStep("fulfilment", {
        ...delivery,
        address_line1: "12 MG Road",
        city: "Chennai",
        state: "Tamil Nadu",
        postal_code: "600001",
      }),
    ).toEqual({});
  });

  it("rejects pay-at-store with delivery and reports the first incomplete step", () => {
    const bad = {
      ...filled,
      fulfilment_method: "delivery" as const,
      payment_method: "pay_at_store" as const,
    };
    expect(validateStep("payment", bad).payment_method).toBeTruthy();
    expect(firstIncompleteStep(EMPTY_CHECKOUT)).toBe("contact");
    expect(firstIncompleteStep(filled)).toBe("review");
  });

  it("builds the order payload", () => {
    const payload = toOrderPayload({ ...filled, contact_email: " priya@example.com " });
    expect(payload).toMatchObject({
      fulfilment_method: "store_pickup",
      store_id: "store-1",
      contact_email: "priya@example.com",
      shipping_address: undefined,
    });
  });
});
