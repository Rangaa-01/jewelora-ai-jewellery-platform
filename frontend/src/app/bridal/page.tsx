import type { Metadata } from "next";
import { TryOnStudio } from "@/components/tryon/tryon-studio";

export const metadata: Metadata = {
  title: "Bridal Mode",
  description: "Create and share your complete bridal jewellery look on your own photo.",
};

export default async function BridalPage(props: PageProps<"/bridal">) {
  const search = await props.searchParams;
  const raw = typeof search.products === "string" ? search.products : "";
  const initialSlugs = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]+$/.test(s))
    .slice(0, 12);
  return <TryOnStudio initialSlugs={initialSlugs} mode="bridal" />;
}
