import type { Metadata } from "next";
import { AppointmentForm } from "@/components/appointments/appointment-form";

export const metadata: Metadata = {
  title: "Book a Visit",
  description: "Book a private appointment at our showroom.",
};

function slugs(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]+$/.test(s))
    .slice(0, 20);
}

export default async function NewAppointmentPage(props: PageProps<"/appointments/new">) {
  const search = await props.searchParams;
  const productSlugs = [...slugs(search.product), ...slugs(search.products)];
  const lookToken =
    typeof search.look === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(search.look)
      ? search.look
      : undefined;
  return <AppointmentForm productSlugs={productSlugs} lookToken={lookToken} />;
}
