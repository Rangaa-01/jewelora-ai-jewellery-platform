"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import type { Order, OrderStatus } from "@/lib/api/types";
import { useAdminOrder, useAdminOrders, useUpdateOrder } from "@/lib/admin/hooks";
import { ORDER_NEXT, ORDER_STATUSES, ORDER_STATUS_META, PAYMENT_METHOD_LABELS } from "@/lib/admin/status";
import { formatDate, formatPrice } from "@/lib/format";
import { Card, ConfirmDialog, DataTable, KeyValue, PageHeader, Pagination, QueryState, SearchInput, StatusBadge, type Column } from "./primitives";

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

export function OrdersTable() {
  const { params, set } = useListParams();
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? 1);
  const query = useAdminOrders({ status: status || undefined, q: q || undefined, page });

  const columns: Column<Order>[] = [
    { key: "number", header: "Order", cell: (o) => <span className="font-medium">{o.order_number}</span> },
    { key: "customer", header: "Customer", cell: (o) => (<span>{o.contact_name}<span className="text-fg-muted block text-xs">{o.contact_phone}</span></span>) },
    { key: "status", header: "Status", cell: (o) => <StatusBadge {...ORDER_STATUS_META[o.status]} /> },
    { key: "total", header: "Total", className: "text-right", cell: (o) => <span className="tabular-nums">{formatPrice(o.grand_total)}</span> },
    { key: "method", header: "Payment", hideBelow: "md", cell: (o) => PAYMENT_METHOD_LABELS[o.payment_method] ?? o.payment_method },
    { key: "placed", header: "Placed", hideBelow: "lg", cell: (o) => formatDate(o.placed_at, { timeStyle: "short" }) },
  ];

  return (
    <>
      <PageHeader title="Orders" description="Confirm, prepare and settle customer orders." />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={q} onChange={(v) => set({ q: v, page: undefined })} placeholder="Order number, name or phone" label="Search orders" />
        <Select
          label="Status"
          wrapperClassName="md:w-56"
          value={status}
          onChange={(e) => set({ status: e.target.value, page: undefined })}
          options={[{ value: "", label: "All statuses" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_META[s].label }))]}
        />
      </div>
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <>
            <DataTable
              columns={columns}
              rows={query.data.items}
              getKey={(o) => o.id}
              caption="Orders"
              rowHref={(o) => `/admin/orders/${o.id}`}
              empty={<EmptyState compact title="No orders here" description="Orders placed by customers will appear in this list." />}
            />
            <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={(p) => set({ page: p })} />
          </>
        )}
      </QueryState>
    </>
  );
}

export function OrderDetail({ id }: { id: string }) {
  const query = useAdminOrder(id);
  const update = useUpdateOrder(id);
  const { toast } = useToast();
  const [notes, setNotes] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null);

  const apply = async (input: { status?: OrderStatus; staff_notes?: string; mark_paid?: boolean }) => {
    try {
      await update.mutateAsync(input);
      toast({ title: "Order updated", tone: "success" });
    } catch (error) {
      toast({ title: "Couldn't update the order", description: errorMessage(error), tone: "error" });
    }
  };

  return (
    <>
      <PageHeader
        backHref="/admin/orders"
        backLabel="Orders"
        title={query.data ? `Order ${query.data.order_number}` : "Order"}
        description={query.data ? `Placed ${formatDate(query.data.placed_at, { timeStyle: "short" })}` : undefined}
        actions={query.data && <StatusBadge {...ORDER_STATUS_META[query.data.status]} />}
      />
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card title="Items">
                <ul className="divide-border divide-y">
                  {query.data.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <span className="bg-bg-muted relative size-14 shrink-0 overflow-hidden rounded-sm">
                        {item.image_url && <Image src={item.image_url} alt="" fill sizes="56px" className="object-cover" unoptimized />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-fg-muted text-xs">
                          {item.sku}
                          {item.variant_label && ` · ${item.variant_label}`}
                          {item.size_label && ` · Size ${item.size_label}`}
                        </p>
                      </div>
                      <div className="text-right text-sm tabular-nums">
                        <p>{item.quantity} × {formatPrice(item.unit_price)}</p>
                        <p className="font-semibold">{formatPrice(item.line_total)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <dl className="border-border mt-3 ml-auto grid max-w-xs grid-cols-2 gap-y-1 border-t pt-3 text-sm">
                  <dt className="text-fg-muted">Subtotal</dt><dd className="text-right tabular-nums">{formatPrice(query.data.subtotal)}</dd>
                  <dt className="text-fg-muted">GST</dt><dd className="text-right tabular-nums">{formatPrice(query.data.tax_total)}</dd>
                  <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tabular-nums">{formatPrice(query.data.grand_total)}</dd>
                </dl>
              </Card>
              <Card title="Customer">
                <KeyValue
                  items={[
                    { label: "Name", value: query.data.contact_name },
                    { label: "Phone", value: query.data.contact_phone },
                    { label: "Email", value: query.data.contact_email },
                    { label: "Fulfilment", value: query.data.fulfilment_method === "store_pickup" ? `Pickup at ${query.data.store_name ?? "store"}` : "Home delivery" },
                    { label: "Address", value: query.data.shipping_address ? Object.values(query.data.shipping_address).filter(Boolean).join(", ") : null },
                    { label: "Customer notes", value: query.data.customer_notes },
                  ]}
                />
              </Card>
            </div>
            <div className="flex flex-col gap-4">
              <Card title="Payment">
                <KeyValue
                  items={[
                    { label: "Method", value: PAYMENT_METHOD_LABELS[query.data.payment_method] ?? query.data.payment_method },
                    { label: "Status", value: query.data.payment ? <Badge tone={query.data.payment.status === "captured" ? "emerald" : "gold"}>{query.data.payment.status}</Badge> : "—" },
                    { label: "Paid at", value: query.data.paid_at ? formatDate(query.data.paid_at, { timeStyle: "short" }) : "Not yet" },
                  ]}
                />
                {!query.data.paid_at && (
                  <Button className="mt-4 w-full" onClick={() => apply({ mark_paid: true })} loading={update.isPending}>
                    Mark as paid
                  </Button>
                )}
              </Card>
              <Card title="Status">
                <div className="flex flex-wrap gap-2">
                  {ORDER_NEXT[query.data.status].map((s) => (
                    <Button key={s} variant={s === "cancelled" || s === "refunded" ? "danger" : "outline"} size="sm" onClick={() => setConfirmStatus(s)}>
                      {ORDER_STATUS_META[s].label}
                    </Button>
                  ))}
                </div>
                <Select
                  label="Set any status"
                  wrapperClassName="mt-4"
                  value={query.data.status}
                  onChange={(e) => setConfirmStatus(e.target.value as OrderStatus)}
                  options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_META[s].label }))}
                />
              </Card>
              <Card title="Staff notes">
                <Textarea label="Internal notes" hint="Never shown to the customer." value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={4} />
                <Button variant="outline" className="mt-3" disabled={notes === null} loading={update.isPending} onClick={() => notes !== null && apply({ staff_notes: notes })}>
                  Save notes
                </Button>
              </Card>
            </div>
          </div>
        )}
      </QueryState>
      <ConfirmDialog
        open={confirmStatus !== null}
        onClose={() => setConfirmStatus(null)}
        title={confirmStatus ? `Mark order as ${ORDER_STATUS_META[confirmStatus].label.toLowerCase()}?` : ""}
        description="The customer will see the new status in their account."
        danger={confirmStatus === "cancelled" || confirmStatus === "refunded"}
        confirmLabel="Update status"
        loading={update.isPending}
        onConfirm={async () => {
          if (!confirmStatus) return;
          await apply({ status: confirmStatus });
          setConfirmStatus(null);
        }}
      />
    </>
  );
}
