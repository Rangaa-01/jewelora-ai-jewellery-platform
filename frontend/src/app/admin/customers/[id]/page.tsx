import type { Metadata } from "next";
import { CustomerDetail } from "@/components/admin/customers";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerPage(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  return <CustomerDetail id={id} />;
}
