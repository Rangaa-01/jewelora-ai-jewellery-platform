"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import {
  useChangePassword,
  useLogoutAll,
  useProfile,
  useSession,
  useStores,
  useUpdateProfile,
} from "@/lib/api/hooks";
import type { CustomerProfile } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { applyApiFieldErrors } from "@/lib/forms";
import { METAL_LABELS } from "@/lib/labels";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  preferred_metal: z.string(),
  preferred_store_id: z.string(),
  address_line1: z.string().trim().max(255),
  address_line2: z.string().trim().max(255),
  city: z.string().trim().max(100),
  state: z.string().trim().max(100),
  postal_code: z.string().trim().max(20),
  marketing_opt_in: z.boolean(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[a-z]/, "Include a lower-case letter")
      .regex(/[A-Z]/, "Include an upper-case letter")
      .regex(/\d/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function toValues(p: CustomerProfile): ProfileValues {
  return {
    full_name: p.user.full_name,
    preferred_metal: p.preferred_metal ?? "",
    preferred_store_id: p.preferred_store_id ?? "",
    address_line1: p.address_line1 ?? "",
    address_line2: p.address_line2 ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    postal_code: p.postal_code ?? "",
    marketing_opt_in: p.marketing_opt_in,
  };
}

function ProfileForm({ profile }: { profile: CustomerProfile }) {
  const update = useUpdateProfile();
  const stores = useStores();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toValues(profile),
  });
  useEffect(() => reset(toValues(profile)), [profile, reset]);
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        try {
          await update.mutateAsync({
            full_name: v.full_name,
            preferred_metal: v.preferred_metal || null,
            preferred_store_id: v.preferred_store_id || null,
            address_line1: v.address_line1 || null,
            address_line2: v.address_line2 || null,
            city: v.city || null,
            state: v.state || null,
            postal_code: v.postal_code || null,
            marketing_opt_in: v.marketing_opt_in,
          });
          toast({ title: "Profile saved", tone: "success", durationMs: 2500 });
        } catch (error) {
          if (!applyApiFieldErrors(error, setError, ["full_name", "city", "state", "postal_code"]))
            toast({ title: "Couldn't save", description: errorMessage(error), tone: "error" });
        }
      })}
      className="border-border bg-bg-elevated grid gap-4 rounded-lg border p-6 sm:grid-cols-2"
    >
      <Input
        label="Full name"
        required
        autoComplete="name"
        wrapperClassName="sm:col-span-2"
        error={errors.full_name?.message}
        {...register("full_name")}
      />
      <Select
        label="Preferred metal"
        options={[
          { value: "", label: "No preference" },
          ...Object.entries(METAL_LABELS).map(([value, label]) => ({ value, label })),
        ]}
        {...register("preferred_metal")}
      />
      <Select
        label="Preferred store"
        options={[
          { value: "", label: "No preference" },
          ...(stores.data ?? []).map((s) => ({ value: s.id, label: `${s.name} — ${s.city}` })),
        ]}
        {...register("preferred_store_id")}
      />
      <Input
        label="Address"
        autoComplete="address-line1"
        wrapperClassName="sm:col-span-2"
        error={errors.address_line1?.message}
        {...register("address_line1")}
      />
      <Input
        label="Apartment, landmark"
        autoComplete="address-line2"
        wrapperClassName="sm:col-span-2"
        {...register("address_line2")}
      />
      <Input
        label="City"
        autoComplete="address-level2"
        error={errors.city?.message}
        {...register("city")}
      />
      <Input
        label="State"
        autoComplete="address-level1"
        error={errors.state?.message}
        {...register("state")}
      />
      <Input
        label="PIN code"
        autoComplete="postal-code"
        inputMode="numeric"
        error={errors.postal_code?.message}
        {...register("postal_code")}
      />
      <Checkbox
        label="Send me new collection launches and private preview invitations"
        {...register("marketing_opt_in")}
      />
      <div className="sm:col-span-2">
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        try {
          await change.mutateAsync({
            current_password: v.current_password,
            new_password: v.new_password,
          });
          reset();
          toast({
            title: "Password updated",
            description: "Other devices have been signed out.",
            tone: "success",
          });
        } catch (error) {
          if (!applyApiFieldErrors(error, setError, ["current_password", "new_password"])) {
            setError("current_password", { type: "server", message: errorMessage(error) });
          }
        }
      })}
      className="border-border bg-bg-elevated grid gap-4 rounded-lg border p-6"
    >
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.current_password?.message}
        {...register("current_password")}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters with upper and lower case letters and a number."
        error={errors.new_password?.message}
        {...register("new_password")}
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirm?.message}
        {...register("confirm")}
      />
      <FormError error={change.error && !errors.current_password ? change.error : null} />
      <div>
        <Button type="submit" variant="outline" loading={change.isPending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function ProfileView() {
  const router = useRouter();
  const session = useSession();
  const profile = useProfile();
  const logoutAll = useLogoutAll();
  const { toast } = useToast();
  useEffect(() => {
    if (session.data === null) router.replace("/account/login?next=/account/profile");
  }, [session.data, router]);

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="max-w-3xl">
        <Link
          href="/account"
          className="text-fg-muted hover:text-fg inline-flex min-h-10 items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden /> My account
        </Link>
        <h1 className="mt-3 text-4xl md:text-5xl">Profile &amp; security</h1>
        {session.isPending || profile.isPending || !profile.data ? (
          <Skeleton className="mt-8 h-72 rounded-lg" aria-busy="true" />
        ) : (
          <>
            <dl className="text-fg-muted mt-6 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs tracking-wider uppercase">Email</dt>
                <dd className="text-fg mt-1">{profile.data.user.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wider uppercase">Phone</dt>
                <dd className="text-fg mt-1">{profile.data.user.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wider uppercase">Member since</dt>
                <dd className="text-fg mt-1">{formatDate(profile.data.user.created_at)}</dd>
              </div>
            </dl>
            <h2 className="mt-10 mb-4 text-2xl">Details</h2>
            <ProfileForm profile={profile.data} />
            <h2 className="mt-10 mb-4 text-2xl">Password</h2>
            <PasswordForm />
            <section className="border-border mt-10 rounded-lg border p-6">
              <h2 className="inline-flex items-center gap-2 text-2xl">
                <ShieldCheck className="text-emerald size-5" aria-hidden /> Sessions &amp; privacy
              </h2>
              <p className="text-fg-muted mt-2 text-sm">
                Signing out everywhere ends your session on every device, including this one. Try-on
                photos are private, kept for 30 days and can be deleted from the try-on studio at
                any time.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  loading={logoutAll.isPending}
                  onClick={async () => {
                    try {
                      await logoutAll.mutateAsync();
                      router.push("/");
                    } catch (error) {
                      toast({
                        title: "Couldn't sign out",
                        description: errorMessage(error),
                        tone: "error",
                      });
                    }
                  }}
                >
                  Sign out everywhere
                </Button>
                <ButtonLink href="/try-on" variant="ghost">
                  Manage try-on photos
                </ButtonLink>
              </div>
            </section>
          </>
        )}
      </Container>
    </Section>
  );
}
