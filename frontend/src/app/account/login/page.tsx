import type { Metadata } from "next";
import { LoginForm } from "@/components/account/auth-forms";
import { AuthShell } from "@/components/account/auth-shell";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/account/login">) {
  const search = await props.searchParams;
  const next =
    typeof search.next === "string" && search.next.startsWith("/") ? search.next : "/account";
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Jewelora"
      description="Pick up your saved looks, wishlist and appointments."
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
