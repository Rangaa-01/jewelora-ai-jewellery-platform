import type { Metadata } from "next";
import { OrderDetail } from "@/components/orders/order-detail";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage(props: PageProps<"/account/orders/[id]">) {
  const { id } = await props.params;
  return <OrderDetail id={id} />;
}
