import type { Metadata } from "next";
import { RegisterForm } from "@/components/account/auth-forms";
import { AuthShell } from "@/components/account/auth-shell";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage(props: PageProps<"/account/register">) {
  const search = await props.searchParams;
  const next =
    typeof search.next === "string" && search.next.startsWith("/") ? search.next : "/account";
  return (
    <AuthShell
      eyebrow="Join Jewelora"
      title="Create your account"
      description="Save looks, book appointments and get updates on new collections."
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
