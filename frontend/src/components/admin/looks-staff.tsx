"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { Role } from "@/lib/api/types";
import { useAdminLooks, useCreateStaff } from "@/lib/admin/hooks";
import { formatDate, formatPrice } from "@/lib/format";
import { applyApiFieldErrors } from "@/lib/forms";
import { Card, PageHeader, Pagination, QueryState } from "./primitives";

export function LooksGallery() {
  const router = useRouter();
  const params = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const query = useAdminLooks(page);
  return (
    <>
      <PageHeader title="Saved looks" description="Looks customers have created with the try-on studio." />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            {query.data.items.length === 0 ? (
              <EmptyState compact title="No saved looks yet" description="When customers save a try-on look it shows up here." />
            ) : (
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {query.data.items.map((look) => (
                  <li key={look.id} className="bg-bg-elevated border-border overflow-hidden rounded-lg border">
                    <div className="bg-bg-muted relative aspect-[4/5]">
                      {look.preview_url ? (
                        <Image src={look.preview_url} alt={look.title} fill sizes="(min-width: 1280px) 25vw, 50vw" className="object-cover" unoptimized />
                      ) : (
                        <div className="text-fg-muted flex h-full items-center justify-center p-4 text-center text-xs">No preview (saved without a try-on photo)</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-sans text-sm font-semibold">{look.title}</h2>
                        <Badge tone={look.kind === "bridal" ? "rose" : "neutral"}>{look.kind}</Badge>
                      </div>
                      <p className="text-fg-muted mt-1 text-xs">{look.items.map((i) => i.product.name).join(" · ")}</p>
                      <p className="mt-2 text-sm font-medium tabular-nums">{formatPrice(look.total_price)}</p>
                      <p className="text-fg-muted mt-1 text-xs">{formatDate(look.created_at)} · {look.is_public ? `shared ${look.share_count}×` : "private"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={(p) => router.replace(`?page=${p}` as never, { scroll: false })} />
          </>
        )}
      </QueryState>
    </>
  );
}

const staffSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the staff member's name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").regex(/[A-Z]/, "Include an upper-case letter").regex(/[a-z]/, "Include a lower-case letter").regex(/\d/, "Include a number"),
  roles: z.array(z.enum(["admin", "manager", "sales_staff"])).min(1, "Choose at least one role"),
});
type StaffValues = z.infer<typeof staffSchema>;

const ROLE_OPTIONS: Array<{ value: Exclude<Role, "customer">; label: string; hint: string }> = [
  { value: "sales_staff", label: "Sales staff", hint: "Queues: orders, enquiries, appointments, customers." },
  { value: "manager", label: "Manager", hint: "Everything above plus catalogue, collections, stores and customer accounts." },
  { value: "admin", label: "Administrator", hint: "Everything, including staff accounts and product deletion." },
];

export function StaffForm() {
  const create = useCreateStaff();
  const { toast } = useToast();
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<StaffValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { roles: ["sales_staff"] },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await create.mutateAsync(values);
      toast({ title: `${user.full_name} can now sign in`, description: user.email ?? undefined, tone: "success" });
      reset({ roles: ["sales_staff"], full_name: "", email: "", password: "" });
    } catch (error) {
      applyApiFieldErrors(error, setError, ["full_name", "email", "password"]);
    }
  });
  return (
    <>
      <PageHeader title="Staff" description="Create accounts for the shop team. Share the password privately; they can change it after signing in." />
      <Card className="max-w-xl">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <Input label="Full name" error={errors.full_name?.message} {...register("full_name")} />
          <Input label="Work email" type="email" autoComplete="off" error={errors.email?.message} {...register("email")} />
          <Input label="Temporary password" type="password" autoComplete="new-password" hint="8+ characters with upper, lower case and a number." error={errors.password?.message} {...register("password")} />
          <fieldset>
            <legend className="text-fg-soft text-sm font-medium">Roles</legend>
            {ROLE_OPTIONS.map((r) => (
              <Checkbox key={r.value} value={r.value} label={<span>{r.label}<span className="text-fg-muted block text-xs">{r.hint}</span></span>} {...register("roles")} />
            ))}
            {errors.roles?.message && <p role="alert" className="text-danger text-sm">{errors.roles.message}</p>}
          </fieldset>
          <FormError error={create.error} />
          <Button type="submit" loading={isSubmitting || create.isPending}>Create staff account</Button>
        </form>
      </Card>
    </>
  );
}
