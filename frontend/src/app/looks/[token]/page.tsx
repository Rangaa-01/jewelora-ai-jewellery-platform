import type { Metadata } from "next";
import { SharedLookView } from "@/components/looks/shared-look";

export const metadata: Metadata = { title: "Shared look" };

export default async function SharedLookPage(props: PageProps<"/looks/[token]">) {
  const { token } = await props.params;
  return <SharedLookView token={token} />;
}
