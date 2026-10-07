"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/api/hooks";
import type { AdminCustomer } from "@/lib/api/types";
import { useAdminCustomer, useAdminCustomers, useUpdateCustomer } from "@/lib/admin/hooks";
import { canManageCatalogue } from "@/lib/admin/nav";
import { formatDate } from "@/lib/format";
import { Card, ConfirmDialog, DataTable, KeyValue, PageHeader, Pagination, QueryState, SearchInput, type Column } from "./primitives";

export function CustomersTable() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1);
  const query = useAdminCustomers(q, page);
  const set = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || v === 1) next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`?${next.toString()}` as never, { scroll: false });
    },
    [params, router],
  );

  const columns: Column<AdminCustomer>[] = [
    { key: "name", header: "Customer", cell: (c) => (<span className="font-medium">{c.user.full_name}{!c.user.is_active && <Badge tone="danger" className="ml-2">Deactivated</Badge>}</span>) },
    { key: "contact", header: "Contact", cell: (c) => (<span className="text-fg-soft text-xs">{c.user.email ?? "—"}<br />{c.user.phone ?? ""}</span>) },
    { key: "city", header: "City", hideBelow: "md", cell: (c) => c.city ?? "—" },
    { key: "activity", header: "Activity", hideBelow: "md", cell: (c) => (<span className="text-xs tabular-nums">{c.orders_count} orders · {c.appointments_count} visits · {c.enquiries_count} enquiries · {c.looks_count} looks · {c.wishlist_count} wishlist</span>) },
    { key: "joined", header: "Joined", hideBelow: "lg", cell: (c) => formatDate(c.created_at) },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Everyone with a Jewelora account." />
      <div className="mb-4">
        <SearchInput value={q} onChange={(v) => set({ q: v, page: undefined })} placeholder="Name, email or phone" label="Search customers" />
      </div>
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <DataTable columns={columns} rows={query.data.items} getKey={(c) => c.id} caption="Customers" rowHref={(c) => `/admin/customers/${c.id}`} empty={<EmptyState compact title="No customers found" description={q ? "Try a different search." : "Customers appear here once they register."} />} />
            <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={(p) => set({ page: p })} />
          </>
        )}
      </QueryState>
    </>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const query = useAdminCustomer(id);
  const update = useUpdateCustomer(id);
  const session = useSession();
  const canManage = canManageCatalogue(session.data?.user.roles);
  const { toast } = useToast();
  const [notes, setNotes] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const apply = async (input: { notes?: string | null; is_active?: boolean }) => {
    try {
      await update.mutateAsync(input);
      toast({ title: "Customer updated", tone: "success" });
    } catch (error) {
      toast({ title: "Couldn't update the customer", description: errorMessage(error), tone: "error" });
    }
  };

  const c = query.data;
  return (
    <>
      <PageHeader backHref="/admin/customers" backLabel="Customers" title={c?.user.full_name ?? "Customer"} description={c ? `Joined ${formatDate(c.created_at)}` : undefined} actions={c && !c.user.is_active && <Badge tone="danger">Deactivated</Badge>} />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {c && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card title="Profile">
                <KeyValue
                  items={[
                    { label: "Email", value: c.user.email ? <>{c.user.email} {c.email_verified && <Badge tone="emerald">verified</Badge>}</> : null },
                    { label: "Phone", value: c.user.phone ? <>{c.user.phone} {c.phone_verified && <Badge tone="emerald">verified</Badge>}</> : null },
                    { label: "City", value: c.city },
                    { label: "State", value: c.state },
                    { label: "Preferred metal", value: c.preferred_metal },
                    { label: "Marketing", value: c.marketing_opt_in ? "Opted in" : "Not opted in" },
                    { label: "Last sign-in", value: c.last_login_at ? formatDate(c.last_login_at, { timeStyle: "short" }) : "Never" },
                  ]}
                />
              </Card>
              <Card title="Activity">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    ["Orders", c.orders_count],
                    ["Appointments", c.appointments_count],
                    ["Enquiries", c.enquiries_count],
                    ["Looks", c.looks_count],
                    ["Wishlist", c.wishlist_count],
                  ].map(([label, n]) => (
                    <div key={label} className="bg-bg-muted rounded-md p-3 text-center">
                      <p className="font-display text-2xl">{n}</p>
                      <p className="text-fg-muted text-xs">{label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="flex flex-col gap-4">
              <Card title="Staff notes">
                <Textarea label="Notes" hint="Never shown to the customer." rows={5} value={notes ?? c.notes ?? ""} onChange={(e) => setNotes(e.target.value)} disabled={!canManage} />
                {canManage && (
                  <Button variant="outline" className="mt-3" disabled={notes === null} loading={update.isPending} onClick={() => notes !== null && apply({ notes })}>
                    Save notes
                  </Button>
                )}
              </Card>
              {canManage && (
                <Card title="Account">
                  <p className="text-fg-muted text-sm">{c.user.is_active ? "Deactivating signs the customer out everywhere and blocks sign-in." : "This account is deactivated."}</p>
                  <Button variant={c.user.is_active ? "danger" : "outline"} className="mt-3" onClick={() => (c.user.is_active ? setConfirm(true) : apply({ is_active: true }))} loading={update.isPending}>
                    {c.user.is_active ? "Deactivate account" : "Reactivate account"}
                  </Button>
                </Card>
              )}
            </div>
          </div>
        )}
      </QueryState>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Deactivate this customer?" description="They will be signed out and unable to sign in until reactivated." confirmLabel="Deactivate" danger loading={update.isPending} onConfirm={async () => { await apply({ is_active: false }); setConfirm(false); }} />
    </>
  );
}
