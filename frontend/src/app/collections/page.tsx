import type { Metadata } from "next";
import { CollectionsIndex } from "@/components/collections/collections-index";

export const metadata: Metadata = {
  title: "Collections",
  description: "Curated jewellery collections for weddings, festivals, everyday wear and gifting.",
};

export default async function CollectionsPage(props: PageProps<"/collections">) {
  const params = await props.searchParams;
  return <CollectionsIndex bridalOnly={params.bridal === "true"} />;
}
