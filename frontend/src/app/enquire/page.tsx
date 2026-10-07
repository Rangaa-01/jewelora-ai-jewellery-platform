import type { Metadata } from "next";
import { EnquiryForm } from "@/components/enquiry/enquiry-form";

export const metadata: Metadata = { title: "Ask about jewellery" };

export default async function EnquirePage(props: PageProps<"/enquire">) {
  const search = await props.searchParams;
  const productSlug =
    typeof search.product === "string" && /^[a-z0-9-]+$/.test(search.product)
      ? search.product
      : undefined;
  return <EnquiryForm productSlug={productSlug} />;
}
