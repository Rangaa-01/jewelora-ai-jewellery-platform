import type { Metadata } from "next";
import { OrderDetail } from "@/components/admin/orders";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  return <OrderDetail id={id} />;
}
