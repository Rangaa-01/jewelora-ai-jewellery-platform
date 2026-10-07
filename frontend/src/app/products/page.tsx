import type { Metadata } from "next";
import { Catalogue } from "@/components/catalogue/catalogue";
import { parseProductFilters } from "@/lib/catalogue-params";

export const metadata: Metadata = {
  title: "All Jewellery",
  description:
    "Browse necklaces, earrings, rings, bangles and bridal sets. Filter by metal, stone, price and virtual try-on.",
};

export default async function ProductsPage(props: PageProps<"/products">) {
  const search = await props.searchParams;
  return <Catalogue initialFilters={parseProductFilters(search)} title="All Jewellery" />;
}
