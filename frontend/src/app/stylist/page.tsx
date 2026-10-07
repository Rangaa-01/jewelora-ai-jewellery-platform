import type { Metadata } from "next";
import { StylistView } from "@/components/stylist/stylist-view";

export const metadata: Metadata = {
  title: "AI Stylist",
  description:
    "Describe the occasion and budget and get jewellery recommendations from our catalogue.",
};

export default async function StylistPage(props: PageProps<"/stylist">) {
  const search = await props.searchParams;
  const q = typeof search.q === "string" ? search.q.slice(0, 500) : "";
  return <StylistView initialQuery={q} />;
}
