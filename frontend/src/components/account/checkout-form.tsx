"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useCartTotals } from "./cart-view";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import { useSession, useStores } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/format";
import { PHONE_PATTERN, applyApiFieldErrors } from "@/lib/forms";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useShopperStore } from "@/lib/stores/shopper-store";

const schema = z
  .object({
    contact_name: z.string().trim().min(2, "Enter your name"),
    contact_phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
    contact_email: z.string().trim().email("Enter a valid email").or(z.literal("")),
    fulfilment_method: z.enum(["store_pickup", "delivery"]),
    store_id: z.string(),
    payment_method: z.enum(["pay_at_store", "razorpay"]),
    address_line1: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim(),
    postal_code: z.string().trim(),
    customer_notes: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment_method === "store_pickup" && !v.store_id)
      ctx.addIssue({ code: "custom", path: ["store_id"], message: "Choose a store" });
    if (v.fulfilment_method === "delivery") {
      for (const f of ["address_line1", "city", "state", "postal_code"] as const)
        if (!v[f]) ctx.addIssue({ code: "custom", path: [f], message: "Required for delivery" });
    }
  });
type Values = z.infer<typeof schema>;

interface OrderResponse {
  id: string;
  order_number: string;
  payment?: { checkout_url?: string | null } | null;
}

export function CheckoutForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { cart, subtotal } = useCartTotals();
  const clearCart = useShopperStore((s) => s.clearCart);
  const session = useSession();
  const stores = useStores();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fulfilment_method: "store_pickup",
      payment_method: "pay_at_store",
      store_id: "",
      contact_email: "",
      address_line1: "",
      city: "",
      state: "",
      postal_code: "",
      customer_notes: "",
      contact_name: "",
      contact_phone: "",
    },
  });
  useEffect(() => {
    if (session.data) {
      setValue("contact_name", session.data.user.full_name);
      if (session.data.user.phone) setValue("contact_phone", session.data.user.phone);
      if (session.data.user.email) setValue("contact_email", session.data.user.email);
    }
  }, [session.data, setValue]);

  const fulfilment = useWatch({ control, name: "fulfilment_method" });
  const placeOrder = useMutation({
    mutationFn: (values: Values) =>
      api.post<OrderResponse>("/orders", {
        ...values,
        contact_email: values.contact_email || undefined,
        store_id: values.fulfilment_method === "store_pickup" ? values.store_id : undefined,
        shipping_address:
          values.fulfilment_method === "delivery"
            ? {
                line1: values.address_line1,
                city: values.city,
                state: values.state,
                postal_code: values.postal_code,
                country: "IN",
              }
            : undefined,
        items: cart.map((c) => ({
          product_id: c.productId,
          variant_id: c.variantId,
          size_id: c.sizeId,
          quantity: c.quantity,
        })),
      }),
    onSuccess: (order) => {
      clearCart();
      toast({ title: `Order ${order.order_number} placed`, tone: "success" });
      if (order.payment?.checkout_url) window.location.assign(order.payment.checkout_url);
      else router.push("/account/orders");
    },
    onError: (error) =>
      applyApiFieldErrors(error, setError, [
        "contact_name",
        "contact_phone",
        "contact_email",
        "store_id",
        "address_line1",
        "city",
        "state",
        "postal_code",
      ]),
  });

  if (!hydrated || session.isPending) {
    return (
      <Section aria-busy="true">
        <Container>
          <Skeleton className="h-96 rounded-lg" />
        </Container>
      </Section>
    );
  }
  if (cart.length === 0) {
    return (
      <Section>
        <Container className="max-w-xl">
          <EmptyState
            title="Your bag is empty"
            description="Add jewellery to your bag before checking out."
            action={<ButtonLink href="/products">Browse jewellery</ButtonLink>}
          />
        </Container>
      </Section>
    );
  }
  if (session.data === null) {
    return (
      <Section>
        <Container className="max-w-xl">
          <EmptyState
            title="Sign in to check out"
            description="Orders are linked to your account so you can track them and bring them to the store."
            action={
              <div className="flex gap-3">
                <ButtonLink href="/account/login?next=/checkout">Sign in</ButtonLink>
                <ButtonLink href="/account/register?next=/checkout" variant="outline">
                  Create account
                </ButtonLink>
              </div>
            }
          />
        </Container>
      </Section>
    );
  }

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <p className="eyebrow mb-2">Checkout</p>
        <h1 className="text-4xl md:text-5xl">Almost yours</h1>
        <form
          onSubmit={handleSubmit((v) => placeOrder.mutate(v))}
          noValidate
          className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]"
        >
          <div className="flex flex-col gap-8">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-2xl">Contact</legend>
              <Input
                label="Full name"
                required
                autoComplete="name"
                error={errors.contact_name?.message}
                {...register("contact_name")}
              />
              <Input
                label="Phone"
                type="tel"
                required
                autoComplete="tel"
                error={errors.contact_phone?.message}
                {...register("contact_phone")}
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                wrapperClassName="sm:col-span-2"
                error={errors.contact_email?.message}
                {...register("contact_email")}
              />
            </fieldset>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-2xl">Collection</legend>
              <Select
                label="How would you like to receive it?"
                options={[
                  { value: "store_pickup", label: "Collect in store (recommended)" },
                  { value: "delivery", label: "Insured home delivery" },
                ]}
                {...register("fulfilment_method")}
              />
              {fulfilment === "store_pickup" ? (
                <Select
                  label="Store"
                  placeholder="Choose a store"
                  options={(stores.data ?? []).map((s) => ({
                    value: s.id,
                    label: `${s.name} — ${s.city}`,
                  }))}
                  error={
                    errors.store_id?.message ??
                    (stores.data && stores.data.length === 0
                      ? "No stores are published yet. Choose delivery or contact us."
                      : undefined)
                  }
                  {...register("store_id")}
                />
              ) : (
                <>
                  <Input
                    label="Address"
                    autoComplete="address-line1"
                    wrapperClassName="sm:col-span-2"
                    error={errors.address_line1?.message}
                    {...register("address_line1")}
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
                </>
              )}
            </fieldset>
            <fieldset className="grid gap-4">
              <legend className="mb-3 text-2xl">Payment</legend>
              <Select
                label="Payment method"
                options={[
                  { value: "pay_at_store", label: "Pay at the store (reserve now)" },
                  { value: "razorpay", label: "Pay online (UPI, cards, net banking)" },
                ]}
                hint="Online payment is processed by our payment partner on a secure page."
                {...register("payment_method")}
              />
              <Textarea
                label="Notes for the store"
                rows={3}
                error={errors.customer_notes?.message}
                {...register("customer_notes")}
              />
            </fieldset>
            <FormError error={placeOrder.error} />
          </div>
          <aside className="border-border bg-bg-elevated h-fit rounded-lg border p-6 lg:sticky lg:top-24">
            <h2 className="text-2xl">Order summary</h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {cart.map((c) => (
                <li
                  key={`${c.productId}${c.variantId}${c.sizeId}`}
                  className="flex justify-between gap-3"
                >
                  <span className="min-w-0 truncate">
                    {c.name}
                    {c.quantity > 1 ? ` × ${c.quantity}` : ""}
                  </span>
                  <span className="tabular-nums">{formatPrice(Number(c.price) * c.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="border-border mt-4 flex justify-between border-t pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(subtotal)}</span>
            </p>
            <Button type="submit" size="lg" className="mt-6 w-full" loading={placeOrder.isPending}>
              Place order
            </Button>
            <p className="text-fg-muted mt-3 text-xs">
              By placing an order you agree to the final price being confirmed on the day’s gold
              rate before payment is taken.
            </p>
          </aside>
        </form>
      </Container>
    </Section>
  );
}
