import type { Metadata } from "next";
import { EnquiryForm } from "@/components/enquiry/enquiry-form";

export const metadata: Metadata = { title: "Ask about jewellery" };

export default async function EnquirePage(props: PageProps<"/enquire">) {
  const search = await props.searchParams;
  const productSlug =
    typeof search.product === "string" && /^[a-z0-9-]+$/.test(search.product)
      ? search.product
      : undefined;
  const lookToken =
    typeof search.look === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(search.look)
      ? search.look
      : undefined;
  return <EnquiryForm productSlug={productSlug} lookToken={lookToken} />;
}
