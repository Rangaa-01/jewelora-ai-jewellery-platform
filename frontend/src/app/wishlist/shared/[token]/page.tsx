import type { Metadata } from "next";
import { SharedWishlistView } from "@/components/account/shared-wishlist";

export const metadata: Metadata = { title: "Shared wishlist" };

export default async function SharedWishlistPage(props: PageProps<"/wishlist/shared/[token]">) {
  const { token } = await props.params;
  return <SharedWishlistView token={token} />;
}
