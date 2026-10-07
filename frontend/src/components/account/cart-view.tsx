"use client";

import { CircleAlert, Minus, Plus, ShoppingBag, Trash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useCart, useRemoveCartItem, useUpdateCartItem } from "@/lib/api/hooks";
import type { CartItem } from "@/lib/api/types";
import { formatPrice } from "@/lib/format";
import { METAL_LABELS } from "@/lib/labels";

export function cartLineLabel(item: CartItem): string | null {
  const parts: string[] = [];
  if (item.variant)
    parts.push(
      `${METAL_LABELS[item.variant.metal_type]}${item.variant.purity ? ` ${item.variant.purity}` : ""}`,
    );
  if (item.size) parts.push(item.size.label);
  return parts.length ? parts.join(" · ") : null;
}

function CartLine({ item }: { item: CartItem }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const { toast } = useToast();
  const busy = update.isPending || remove.isPending;
  const change = (quantity: number) =>
    update.mutate(
      { itemId: item.id, quantity },
      {
        onError: (e) =>
          toast({ title: "Couldn't update quantity", description: errorMessage(e), tone: "error" }),
      },
    );
  const label = cartLineLabel(item);
  return (
    <li className="flex gap-4 py-5">
      <Link
        href={`/products/${item.product.slug}`}
        className="bg-bg-muted relative size-24 shrink-0 overflow-hidden rounded-md sm:size-28"
      >
        {item.product.primary_image ? (
          <Image
            src={item.product.primary_image.url}
            alt=""
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <ProductImagePlaceholder />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/products/${item.product.slug}`}
          className="hover:text-accent-text font-medium"
        >
          {item.product.name}
        </Link>
        {label && <p className="text-fg-muted text-sm">{label}</p>}
        <p className="text-fg-muted text-sm tabular-nums">{formatPrice(item.unit_price)} each</p>
        {!item.available && (
          <p className="text-danger inline-flex items-center gap-1 text-sm" role="status">
            <CircleAlert className="size-4" aria-hidden /> Not available in this quantity — reduce
            it or remove the piece to check out.
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <div
            className="border-border inline-flex items-center rounded-sm border"
            role="group"
            aria-label={`Quantity for ${item.product.name}`}
          >
            <button
              type="button"
              className="touch-target hover:bg-bg-muted inline-flex items-center justify-center disabled:opacity-40"
              aria-label="Decrease quantity"
              disabled={busy}
              onClick={() => change(item.quantity - 1)}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="min-w-8 text-center text-sm tabular-nums" aria-live="polite">
              {item.quantity}
            </span>
            <button
              type="button"
              className="touch-target hover:bg-bg-muted inline-flex items-center justify-center disabled:opacity-40"
              aria-label="Increase quantity"
              disabled={busy || item.quantity >= 10}
              onClick={() => change(item.quantity + 1)}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
          <p className="font-semibold tabular-nums">{formatPrice(item.line_total)}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              remove.mutate(item.id, {
                onError: (e) =>
                  toast({
                    title: "Couldn't remove item",
                    description: errorMessage(e),
                    tone: "error",
                  }),
              })
            }
            className="text-fg-muted hover:text-danger inline-flex min-h-10 items-center gap-1 text-sm disabled:opacity-40"
          >
            <Trash className="size-4" aria-hidden /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartSummary({
  subtotal,
  tax,
  total,
  children,
}: {
  subtotal: string;
  tax: string;
  total: string;
  children?: React.ReactNode;
}) {
  return (
    <aside className="border-border bg-bg-elevated h-fit rounded-lg border p-6 lg:sticky lg:top-24">
      <h2 className="text-2xl">Summary</h2>
      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-fg-muted">Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-muted">GST (3%)</dt>
          <dd className="tabular-nums">{formatPrice(tax)}</dd>
        </div>
        <div className="border-border flex justify-between border-t pt-3 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(total)}</dd>
        </div>
      </dl>
      <p className="text-fg-muted mt-3 text-xs">
        Gold prices follow the daily rate; the final amount is confirmed before payment.
      </p>
      {children}
    </aside>
  );
}

export function CartView() {
  const cart = useCart();

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <p className="eyebrow mb-2">Your bag</p>
        <h1 className="text-4xl md:text-5xl">Shopping bag</h1>
        <div className="mt-8">
          {cart.isPending ? (
            <Skeleton className="h-40 rounded-lg" aria-busy="true" />
          ) : cart.error ? (
            <ErrorState title="We couldn't load your bag" onRetry={() => void cart.refetch()} />
          ) : cart.data.items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Pieces you add appear here. You can reserve them for a showroom visit or check out online."
              action={<ButtonLink href="/products">Browse jewellery</ButtonLink>}
            />
          ) : (
            <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
              <ul className="divide-border flex flex-col divide-y">
                {cart.data.items.map((item) => (
                  <CartLine key={item.id} item={item} />
                ))}
              </ul>
              <CartSummary
                subtotal={cart.data.subtotal}
                tax={cart.data.tax_total}
                total={cart.data.grand_total}
              >
                {cart.data.items.some((i) => !i.available) ? (
                  <Button size="lg" className="mt-6 w-full" disabled>
                    Resolve unavailable items
                  </Button>
                ) : (
                  <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">
                    Proceed to checkout
                  </ButtonLink>
                )}
                <ButtonLink
                  href={`/appointments/new?products=${cart.data.items.map((i) => i.product.slug).join(",")}`}
                  variant="outline"
                  className="mt-3 w-full"
                >
                  Reserve for a store visit
                </ButtonLink>
              </CartSummary>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
