"use client";

import type { RazorpayCheckout } from "@/lib/api/types";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: {
    key: string;
    amount: number;
    currency: string;
    order_id: string;
    name: string;
    description: string;
    prefill: { name: string; contact: string; email?: string };
    theme: { color: string };
    handler: (response: RazorpaySuccess) => void;
    modal: { ondismiss: () => void };
  }): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/** Loads Razorpay Checkout.js on demand (only when an order carries an online payment). */
export async function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return window.Razorpay;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("razorpay_unavailable")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("razorpay_unavailable"));
    document.head.appendChild(script);
  });
  if (!window.Razorpay) throw new Error("razorpay_unavailable");
  return window.Razorpay;
}

/** Opens the Razorpay checkout for an order; resolves with the signed payment details. */
export async function payWithRazorpay(
  checkout: RazorpayCheckout,
  contact: { name: string; phone: string; email?: string | null },
  description: string,
): Promise<RazorpaySuccess | null> {
  if (!checkout.key_id || !checkout.order_id || checkout.amount === null) return null;
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    const instance = new Razorpay({
      key: checkout.key_id!,
      amount: checkout.amount!,
      currency: checkout.currency,
      order_id: checkout.order_id!,
      name: "Jewelora",
      description,
      prefill: { name: contact.name, contact: contact.phone, email: contact.email ?? undefined },
      theme: { color: "#c9a24b" },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => resolve(null) },
    });
    instance.open();
  });
}
