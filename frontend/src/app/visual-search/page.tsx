import type { Metadata } from "next";
import { VisualSearchView } from "@/components/visual-search/visual-search-view";

export const metadata: Metadata = {
  title: "Visual Search",
  description: "Upload a jewellery photo and find matching pieces in our catalogue.",
};

export default function VisualSearchPage() {
  return <VisualSearchView />;
}
