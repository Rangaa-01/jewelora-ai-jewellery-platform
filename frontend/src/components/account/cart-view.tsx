"use client";

import { Minus, Plus, ShoppingBag, Trash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { formatPrice } from "@/lib/format";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { cartItemKey, useShopperStore } from "@/lib/stores/shopper-store";

export function useCartTotals() {
  const cart = useShopperStore((s) => s.cart);
  const subtotal = cart.reduce((sum, c) => sum + Number(c.price) * c.quantity, 0);
  return { cart, subtotal, count: cart.reduce((n, c) => n + c.quantity, 0) };
}

export function CartView() {
  const hydrated = useHydrated();
  const { cart, subtotal } = useCartTotals();
  const update = useShopperStore((s) => s.updateCartQuantity);
  const remove = useShopperStore((s) => s.removeFromCart);

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <p className="eyebrow mb-2">Your bag</p>
        <h1 className="text-4xl md:text-5xl">Shopping bag</h1>
        <div className="mt-8">
          {!hydrated ? (
            <Skeleton className="h-40 rounded-lg" aria-busy="true" />
          ) : cart.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Pieces you add appear here. You can reserve them for a showroom visit or check out online."
              action={<ButtonLink href="/products">Browse jewellery</ButtonLink>}
            />
          ) : (
            <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
              <ul className="divide-border flex flex-col divide-y">
                {cart.map((item) => {
                  const key = cartItemKey(item);
                  return (
                    <li key={key} className="flex gap-4 py-5">
                      <Link
                        href={`/products/${item.slug}`}
                        className="bg-bg-muted relative size-24 shrink-0 overflow-hidden rounded-md"
                      >
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        ) : (
                          <ProductImagePlaceholder />
                        )}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Link
                          href={`/products/${item.slug}`}
                          className="hover:text-accent-text font-medium"
                        >
                          {item.name}
                        </Link>
                        {(item.variantLabel || item.sizeLabel) && (
                          <p className="text-fg-muted text-sm">
                            {[item.variantLabel, item.sizeLabel].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div
                            className="border-border inline-flex items-center rounded-sm border"
                            role="group"
                            aria-label={`Quantity for ${item.name}`}
                          >
                            <button
                              type="button"
                              className="touch-target hover:bg-bg-muted inline-flex items-center justify-center"
                              aria-label="Decrease quantity"
                              onClick={() => update(key, item.quantity - 1)}
                            >
                              <Minus className="size-4" aria-hidden />
                            </button>
                            <span
                              className="min-w-8 text-center text-sm tabular-nums"
                              aria-live="polite"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              className="touch-target hover:bg-bg-muted inline-flex items-center justify-center disabled:opacity-40"
                              aria-label="Increase quantity"
                              disabled={item.quantity >= 10}
                              onClick={() => update(key, item.quantity + 1)}
                            >
                              <Plus className="size-4" aria-hidden />
                            </button>
                          </div>
                          <p className="font-semibold tabular-nums">
                            {formatPrice(Number(item.price) * item.quantity)}
                          </p>
                          <button
                            type="button"
                            onClick={() => remove(key)}
                            className="text-fg-muted hover:text-danger inline-flex min-h-10 items-center gap-1 text-sm"
                          >
                            <Trash className="size-4" aria-hidden /> Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <aside className="border-border bg-bg-elevated h-fit rounded-lg border p-6 lg:sticky lg:top-24">
                <h2 className="text-2xl">Summary</h2>
                <dl className="mt-4 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Subtotal</dt>
                    <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Taxes</dt>
                    <dd>Included</dd>
                  </div>
                  <div className="border-border flex justify-between border-t pt-3 text-base font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                  </div>
                </dl>
                <p className="text-fg-muted mt-3 text-xs">
                  Gold prices follow the daily rate; the final amount is confirmed before payment.
                </p>
                <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">
                  Proceed to checkout
                </ButtonLink>
                <ButtonLink href="/appointments/new" variant="outline" className="mt-3 w-full">
                  Reserve for a store visit
                </ButtonLink>
                <Button
                  variant="ghost"
                  className="mt-3 w-full"
                  onClick={() => useShopperStore.getState().clearCart()}
                >
                  Clear bag
                </Button>
              </aside>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
