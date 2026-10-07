import type { Metadata } from "next";
import { SharedLookView } from "@/components/looks/shared-look";
import { SITE } from "@/lib/site";

export async function generateMetadata(props: PageProps<"/looks/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  return {
    title: "Shared look",
    description: `A jewellery look created with ${SITE.name} virtual try-on.`,
    openGraph: { title: `A ${SITE.name} look`, url: `/looks/${token}` },
    robots: { index: false },
  };
}

export default async function SharedLookPage(props: PageProps<"/looks/[token]">) {
  const { token } = await props.params;
  return <SharedLookView token={token} />;
}
