import type { Metadata } from "next";
import { MyLooksView } from "@/components/looks/my-looks";

export const metadata: Metadata = { title: "Saved looks" };

export default function SavedLooksPage() {
  return <MyLooksView />;
}
