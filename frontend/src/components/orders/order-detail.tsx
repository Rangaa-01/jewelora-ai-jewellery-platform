"use client";

import { Check, ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ORDER_STATUS_LABELS, canCancel, orderTimeline, orderTone } from "./order-status";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useCancelOrder, useOrder, useSession } from "@/lib/api/hooks";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OrderDetail({ id }: { id: string }) {
  const router = useRouter();
  const session = useSession();
  const query = useOrder(id);
  const cancel = useCancelOrder();
  const { toast } = useToast();
  useEffect(() => {
    if (session.data === null) router.replace(`/account/login?next=/account/orders/${id}` as never);
  }, [session.data, router, id]);

  const order = query.data;
  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="max-w-4xl">
        <Link
          href="/account/orders"
          className="text-fg-muted hover:text-fg inline-flex min-h-10 items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden /> Orders
        </Link>
        {session.isPending || query.isPending ? (
          <Skeleton className="mt-6 h-96 rounded-lg" aria-busy="true" />
        ) : query.error || !order ? (
          isApiError(query.error) && query.error.isNotFound ? (
            <EmptyState
              title="We couldn't find that order"
              description="It may belong to a different account."
              action={<ButtonLink href="/account/orders">Back to orders</ButtonLink>}
              className="mt-6"
            />
          ) : (
            <ErrorState onRetry={() => void query.refetch()} className="mt-6" />
          )
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">Order {order.order_number}</p>
                <h1 className="text-4xl md:text-5xl">{ORDER_STATUS_LABELS[order.status]}</h1>
                <p className="text-fg-muted mt-2 text-sm">Placed {formatDate(order.placed_at)}</p>
              </div>
              <Badge tone={orderTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
            </div>
            <ol className="mt-8 flex flex-wrap gap-3" aria-label="Order progress">
              {orderTimeline(order).map((m) => (
                <li
                  key={m.status}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm",
                    m.reached
                      ? m.status === "cancelled" || m.status === "refunded"
                        ? "border-danger/40 text-danger"
                        : "border-emerald/40 text-emerald-deep"
                      : "border-border text-fg-muted",
                  )}
                >
                  {m.reached && <Check className="size-3.5" aria-hidden />}
                  {ORDER_STATUS_LABELS[m.status]}
                </li>
              ))}
            </ol>
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
              <ul className="divide-border border-border bg-bg-elevated divide-y rounded-lg border px-5">
                {order.items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-4">
                    <div className="bg-bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <ProductImagePlaceholder />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-fg-muted text-sm">
                        {[item.variant_label, item.size_label].filter(Boolean).join(" · ") ||
                          item.sku}
                      </p>
                      <p className="text-fg-muted text-sm tabular-nums">
                        {item.quantity} × {formatPrice(item.unit_price)}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatPrice(item.line_total)}</p>
                  </li>
                ))}
              </ul>
              <aside className="border-border bg-bg-elevated h-fit rounded-lg border p-6">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Subtotal</dt>
                    <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">GST</dt>
                    <dd className="tabular-nums">{formatPrice(order.tax_total)}</dd>
                  </div>
                  <div className="border-border flex justify-between border-t pt-3 font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatPrice(order.grand_total)}</dd>
                  </div>
                </dl>
                <dl className="mt-6 flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="text-fg-muted text-xs tracking-wider uppercase">Collection</dt>
                    <dd className="mt-1">
                      {order.fulfilment_method === "store_pickup"
                        ? `Collect at ${order.store_name ?? "the store"}`
                        : order.shipping_address
                          ? `${order.shipping_address.line1}, ${order.shipping_address.city} ${order.shipping_address.postal_code}`
                          : "Home delivery"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-xs tracking-wider uppercase">Payment</dt>
                    <dd className="mt-1">
                      {order.payment_method === "pay_at_store"
                        ? "Pay at the store"
                        : order.payment_method === "bank_transfer"
                          ? "Bank transfer"
                          : "Online"}
                      {order.paid_at ? ` · paid ${formatDate(order.paid_at)}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-xs tracking-wider uppercase">Contact</dt>
                    <dd className="mt-1">
                      {order.contact_name} · {order.contact_phone}
                    </dd>
                  </div>
                </dl>
                {canCancel(order) && (
                  <Button
                    variant="outline"
                    className="mt-6 w-full"
                    loading={cancel.isPending}
                    onClick={() =>
                      cancel.mutate(order.id, {
                        onSuccess: () =>
                          toast({ title: "Order cancelled", tone: "success", durationMs: 3000 }),
                        onError: (e) =>
                          toast({
                            title: "Couldn't cancel",
                            description: errorMessage(e),
                            tone: "error",
                          }),
                      })
                    }
                  >
                    Cancel order
                  </Button>
                )}
                <ButtonLink href="/enquire" variant="ghost" className="mt-3 w-full">
                  Ask the store a question
                </ButtonLink>
              </aside>
            </div>
          </>
        )}
      </Container>
    </Section>
  );
}
