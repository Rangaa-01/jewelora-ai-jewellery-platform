import type { Metadata } from "next";
import { TryOnStudio } from "@/components/tryon/tryon-studio";

export const metadata: Metadata = {
  title: "Virtual Try-On",
  description: "Try necklaces, earrings, rings and bangles on your own photo or camera.",
};

function slugs(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]+$/.test(s))
    .slice(0, 12);
}

export default async function TryOnPage(props: PageProps<"/try-on">) {
  const search = await props.searchParams;
  const initialSlugs = [...slugs(search.product), ...slugs(search.products)];
  const variant = typeof search.variant === "string" ? search.variant : undefined;
  return <TryOnStudio initialSlugs={initialSlugs} initialVariantId={variant} mode="look" />;
}
