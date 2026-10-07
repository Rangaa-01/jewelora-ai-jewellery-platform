import type { Metadata } from "next";
import { CartView } from "@/components/account/cart-view";

export const metadata: Metadata = { title: "Bag" };

export default function CartPage() {
  return <CartView />;
}
