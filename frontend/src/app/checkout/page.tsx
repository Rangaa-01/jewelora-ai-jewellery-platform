import type { Metadata } from "next";
import { CheckoutForm } from "@/components/account/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return <CheckoutForm />;
}
