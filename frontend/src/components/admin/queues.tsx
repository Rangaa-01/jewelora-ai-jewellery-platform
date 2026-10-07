"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Tab, TabList, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import type { Appointment, Enquiry } from "@/lib/api/types";
import { useAdminAppointments, useAdminEnquiries, useAdminStores, useUpdateAppointment, useUpdateEnquiry } from "@/lib/admin/hooks";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_META, ENQUIRY_STATUSES, ENQUIRY_STATUS_META } from "@/lib/admin/status";
import { formatDate } from "@/lib/format";
import { DataTable, KeyValue, PageHeader, Pagination, QueryState, StatusBadge, type Column } from "./primitives";

function useListParams() {
  const router = useRouter();
  const params = useSearchParams();
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
  return { params, set };
}

function ProductChip({ product }: { product: { name: string; primary_image: { url: string } | null } }) {
  return (
    <span className="bg-bg-muted inline-flex items-center gap-2 rounded-sm py-1 pr-2 pl-1 text-xs">
      <span className="relative size-6 overflow-hidden rounded-xs">
        {product.primary_image && <Image src={product.primary_image.url} alt="" fill sizes="24px" className="object-cover" unoptimized />}
      </span>
      {product.name}
    </span>
  );
}

export function EnquiriesQueue() {
  const { params, set } = useListParams();
  const status = params.get("status") ?? "new";
  const page = Number(params.get("page") ?? 1);
  const query = useAdminEnquiries(status === "all" ? "" : status, page);
  const update = useUpdateEnquiry();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [notes, setNotes] = useState("");

  const save = async (input: { status?: string; staff_notes?: string }) => {
    if (!selected) return;
    try {
      const next = await update.mutateAsync({ id: selected.id, input });
      setSelected(next);
      toast({ title: "Enquiry updated", tone: "success" });
    } catch (error) {
      toast({ title: "Couldn't update the enquiry", description: errorMessage(error), tone: "error" });
    }
  };

  const columns: Column<Enquiry>[] = [
    { key: "ref", header: "Ref", cell: (e) => <span className="font-medium">{e.reference}</span> },
    { key: "who", header: "Customer", cell: (e) => (<span>{e.name}<span className="text-fg-muted block text-xs">{e.phone} · prefers {e.preferred_contact}</span></span>) },
    { key: "product", header: "About", hideBelow: "md", cell: (e) => (e.product ? <ProductChip product={e.product} /> : <span className="text-fg-muted">General</span>) },
    { key: "status", header: "Status", cell: (e) => <StatusBadge {...ENQUIRY_STATUS_META[e.status]} /> },
    { key: "when", header: "Received", hideBelow: "lg", cell: (e) => formatDate(e.created_at, { timeStyle: "short" }) },
  ];

  return (
    <>
      <PageHeader title="Enquiries" description="Customer questions about pieces and looks." />
      <Tabs value={status} onValueChange={(v) => set({ status: v, page: undefined })} defaultValue="new" className="mb-4">
        <TabList label="Enquiry status">
          {["new", "in_progress", "resolved", "closed", "all"].map((s) => (
            <Tab key={s} value={s}>
              {s === "all" ? "All" : ENQUIRY_STATUS_META[s as keyof typeof ENQUIRY_STATUS_META].label}
            </Tab>
          ))}
        </TabList>
      </Tabs>
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <DataTable
              columns={columns}
              rows={query.data.items}
              getKey={(e) => e.id}
              caption="Enquiries"
              onRowClick={(e) => {
                setSelected(e);
                setNotes("");
              }}
              empty={<EmptyState compact title="No enquiries in this queue" description="New enquiries from the website land here." />}
            />
            <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={(p) => set({ page: p })} />
          </>
        )}
      </QueryState>
      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected ? `Enquiry ${selected.reference}` : ""} description={selected ? `Received ${formatDate(selected.created_at, { timeStyle: "short" })}` : undefined}>
        {selected && (
          <div className="flex flex-col gap-5">
            <KeyValue
              items={[
                { label: "Name", value: selected.name },
                { label: "Phone", value: <a className="underline-offset-4 hover:underline" href={`tel:${selected.phone}`}>{selected.phone}</a> },
                { label: "Email", value: selected.email ? <a className="underline-offset-4 hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a> : null },
                { label: "Preferred contact", value: selected.preferred_contact },
              ]}
            />
            {selected.product && (
              <div>
                <p className="text-fg-muted text-xs tracking-wider uppercase">About</p>
                <div className="mt-1"><ProductChip product={selected.product} /></div>
              </div>
            )}
            <blockquote className="border-gold bg-bg-muted/50 rounded-sm border-l-2 px-3 py-2 text-sm whitespace-pre-wrap">{selected.message}</blockquote>
            <Select
              label="Status"
              value={selected.status}
              onChange={(e) => save({ status: e.target.value })}
              options={ENQUIRY_STATUSES.map((s) => ({ value: s, label: ENQUIRY_STATUS_META[s].label }))}
            />
            <Textarea label="Staff notes" hint="Internal only." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <Button variant="outline" onClick={() => save({ staff_notes: notes })} loading={update.isPending} disabled={!notes}>
              Save notes
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

export function AppointmentsQueue() {
  const { params, set } = useListParams();
  const status = params.get("status") ?? "";
  const storeId = params.get("store_id") ?? "";
  const day = params.get("day") ?? "";
  const page = Number(params.get("page") ?? 1);
  const query = useAdminAppointments({ status: status || undefined, store_id: storeId || undefined, day: day || undefined, page });
  const stores = useAdminStores();
  const update = useUpdateAppointment();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [notes, setNotes] = useState("");

  const save = async (input: { status?: string; staff_notes?: string }) => {
    if (!selected) return;
    try {
      const next = await update.mutateAsync({ id: selected.id, input });
      setSelected(next);
      toast({ title: "Appointment updated", tone: "success" });
    } catch (error) {
      toast({ title: "Couldn't update the appointment", description: errorMessage(error), tone: "error" });
    }
  };

  const columns: Column<Appointment>[] = [
    { key: "when", header: "When", cell: (a) => (<span className="font-medium">{formatDate(a.starts_at, { dateStyle: "medium", timeStyle: "short" })}</span>) },
    { key: "who", header: "Guest", cell: (a) => (<span>{a.guest_name}<span className="text-fg-muted block text-xs">{a.guest_phone} · {a.party_size} {a.party_size === 1 ? "person" : "people"}</span></span>) },
    { key: "store", header: "Store", hideBelow: "md", cell: (a) => a.store.name },
    { key: "purpose", header: "Purpose", hideBelow: "lg", cell: (a) => a.purpose ?? "—" },
    { key: "status", header: "Status", cell: (a) => <StatusBadge {...APPOINTMENT_STATUS_META[a.status]} /> },
  ];

  return (
    <>
      <PageHeader title="Appointments" description="Store visits requested through the website." />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Input label="Day" type="date" value={day} onChange={(e) => set({ day: e.target.value, page: undefined })} />
        <Select label="Store" value={storeId} onChange={(e) => set({ store_id: e.target.value, page: undefined })} options={[{ value: "", label: "All stores" }, ...(stores.data ?? []).map((s) => ({ value: s.id, label: s.name }))]} />
        <Select label="Status" value={status} onChange={(e) => set({ status: e.target.value, page: undefined })} options={[{ value: "", label: "All statuses" }, ...APPOINTMENT_STATUSES.map((s) => ({ value: s, label: APPOINTMENT_STATUS_META[s].label }))]} />
      </div>
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <DataTable
              columns={columns}
              rows={query.data.items}
              getKey={(a) => a.id}
              caption="Appointments"
              onRowClick={(a) => {
                setSelected(a);
                setNotes("");
              }}
              empty={<EmptyState compact title="No appointments match" description="Try another day, store or status." />}
            />
            <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={(p) => set({ page: p })} />
          </>
        )}
      </QueryState>
      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected ? `Appointment ${selected.reference}` : ""}>
        {selected && (
          <div className="flex flex-col gap-5">
            <KeyValue
              items={[
                { label: "When", value: formatDate(selected.starts_at, { dateStyle: "full", timeStyle: "short" }) },
                { label: "Store", value: selected.store.name },
                { label: "Guest", value: selected.guest_name },
                { label: "Phone", value: <a className="underline-offset-4 hover:underline" href={`tel:${selected.guest_phone}`}>{selected.guest_phone}</a> },
                { label: "Email", value: selected.guest_email },
                { label: "Party", value: `${selected.party_size}` },
                { label: "Purpose", value: selected.purpose },
                { label: "Notes from guest", value: selected.notes },
              ]}
            />
            {selected.products.length > 0 && (
              <div>
                <p className="text-fg-muted text-xs tracking-wider uppercase">Wants to see</p>
                <div className="mt-1 flex flex-wrap gap-1.5">{selected.products.map((p) => <ProductChip key={p.id} product={p} />)}</div>
              </div>
            )}
            <Select label="Status" value={selected.status} onChange={(e) => save({ status: e.target.value })} options={APPOINTMENT_STATUSES.map((s) => ({ value: s, label: APPOINTMENT_STATUS_META[s].label }))} />
            <Textarea label="Staff notes" hint="Internal only." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <Button variant="outline" onClick={() => save({ staff_notes: notes })} loading={update.isPending} disabled={!notes}>
              Save notes
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
