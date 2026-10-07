import { CollectionDetail } from "@/components/collections/collection-detail";
import { parseProductFilters } from "@/lib/catalogue-params";

export default async function CollectionPage(props: PageProps<"/collections/[slug]">) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  return <CollectionDetail slug={slug} initialFilters={parseProductFilters(search)} />;
}
