import { PHONE_PATTERN } from "@/lib/forms";
import type { FulfilmentMethod, PaymentMethod } from "@/lib/api/types";

export const CHECKOUT_STEPS = ["contact", "fulfilment", "payment", "review"] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

export interface CheckoutValues {
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  fulfilment_method: FulfilmentMethod;
  store_id: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  payment_method: PaymentMethod;
  customer_notes: string;
}

export type CheckoutErrors = Partial<Record<keyof CheckoutValues, string>>;

export const EMPTY_CHECKOUT: CheckoutValues = {
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  fulfilment_method: "store_pickup",
  store_id: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  payment_method: "pay_at_store",
  customer_notes: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates one checkout step. Returns an empty object when the step is complete. */
export function validateStep(step: CheckoutStep, v: CheckoutValues): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (step === "contact") {
    if (v.contact_name.trim().length < 2) errors.contact_name = "Enter your name";
    if (!PHONE_PATTERN.test(v.contact_phone.trim()))
      errors.contact_phone = "Enter a valid phone number";
    if (v.contact_email.trim() && !EMAIL_PATTERN.test(v.contact_email.trim()))
      errors.contact_email = "Enter a valid email";
  }
  if (step === "fulfilment") {
    if (v.fulfilment_method === "store_pickup" && !v.store_id) errors.store_id = "Choose a store";
    if (v.fulfilment_method === "delivery") {
      if (v.address_line1.trim().length < 3) errors.address_line1 = "Enter your address";
      if (v.city.trim().length < 2) errors.city = "Enter your city";
      if (v.state.trim().length < 2) errors.state = "Enter your state";
      if (!/^\d{6}$/.test(v.postal_code.trim())) errors.postal_code = "Enter a 6-digit PIN code";
    }
  }
  if (step === "payment") {
    if (v.payment_method === "pay_at_store" && v.fulfilment_method !== "store_pickup")
      errors.payment_method = "Pay at store is only available with store pickup";
    if (v.customer_notes.length > 1000) errors.customer_notes = "Keep notes under 1000 characters";
  }
  return errors;
}

export function firstIncompleteStep(v: CheckoutValues): CheckoutStep {
  for (const step of CHECKOUT_STEPS) {
    if (step === "review") break;
    if (Object.keys(validateStep(step, v)).length > 0) return step;
  }
  return "review";
}

/** Maps the step values onto the backend order payload. */
export function toOrderPayload(v: CheckoutValues) {
  return {
    fulfilment_method: v.fulfilment_method,
    store_id: v.fulfilment_method === "store_pickup" ? v.store_id : undefined,
    payment_method: v.payment_method,
    contact_name: v.contact_name.trim(),
    contact_phone: v.contact_phone.trim(),
    contact_email: v.contact_email.trim() || undefined,
    shipping_address:
      v.fulfilment_method === "delivery"
        ? {
            line1: v.address_line1.trim(),
            line2: v.address_line2.trim() || null,
            city: v.city.trim(),
            state: v.state.trim(),
            postal_code: v.postal_code.trim(),
            country: "IN",
          }
        : undefined,
    customer_notes: v.customer_notes.trim() || undefined,
  };
}
