"use client";

import { Check, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { CartSummary, cartLineLabel } from "./cart-view";
import { payWithRazorpay } from "./razorpay";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage, isApiError } from "@/lib/api/client";
import {
  useCart,
  useConfirmPayment,
  usePlaceOrder,
  useProfile,
  useSession,
  useStores,
} from "@/lib/api/hooks";
import type { Order } from "@/lib/api/types";
import { formatPrice } from "@/lib/format";
import {
  CHECKOUT_STEPS,
  EMPTY_CHECKOUT,
  toOrderPayload,
  validateStep,
  type CheckoutErrors,
  type CheckoutStep,
  type CheckoutValues,
} from "@/lib/shop/checkout";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<CheckoutStep, string> = {
  contact: "Contact",
  fulfilment: "Collection",
  payment: "Payment",
  review: "Review",
};

function Stepper({ current }: { current: CheckoutStep }) {
  const index = CHECKOUT_STEPS.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Checkout progress">
      {CHECKOUT_STEPS.map((step, i) => (
        <li
          key={step}
          aria-current={step === current ? "step" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-full border px-3",
            i < index && "border-emerald/40 text-emerald-deep",
            i === index && "border-gold-deep bg-gold/15 font-medium",
            i > index && "border-border text-fg-muted",
          )}
        >
          {i < index ? <Check className="size-3.5" aria-hidden /> : <span>{i + 1}</span>}
          {STEP_LABELS[step]}
        </li>
      ))}
    </ol>
  );
}

export function CheckoutForm() {
  const session = useSession();
  const profile = useProfile();
  const cart = useCart();
  const stores = useStores();
  const placeOrder = usePlaceOrder();
  const confirmPayment = useConfirmPayment();
  const { toast } = useToast();
  const [step, setStep] = useState<CheckoutStep>("contact");
  const [values, setValues] = useState<CheckoutValues>(EMPTY_CHECKOUT);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [placed, setPlaced] = useState<Order | null>(null);
  const [onlineUnavailable, setOnlineUnavailable] = useState(false);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);

  // Seed the form once from the session, profile and store list (render-phase derived state).
  const [seeded, setSeeded] = useState({ session: false, profile: false, stores: false });
  if (!seeded.session && session.data) {
    setSeeded((x) => ({ ...x, session: true }));
    const u = session.data.user;
    setValues((v) => ({
      ...v,
      contact_name: v.contact_name || u.full_name,
      contact_phone: v.contact_phone || (u.phone ?? ""),
      contact_email: v.contact_email || (u.email ?? ""),
    }));
  }
  if (!seeded.profile && profile.data) {
    setSeeded((x) => ({ ...x, profile: true }));
    const pr = profile.data;
    setValues((v) => ({
      ...v,
      address_line1: v.address_line1 || (pr.address_line1 ?? ""),
      address_line2: v.address_line2 || (pr.address_line2 ?? ""),
      city: v.city || (pr.city ?? ""),
      state: v.state || (pr.state ?? ""),
      postal_code: v.postal_code || (pr.postal_code ?? ""),
      store_id: v.store_id || (pr.preferred_store_id ?? ""),
    }));
  }
  if (!seeded.stores && stores.data && stores.data.length > 0) {
    setSeeded((x) => ({ ...x, stores: true }));
    const first = stores.data[0]!;
    setValues((v) => (v.store_id ? v : { ...v, store_id: first.id }));
  }

  const set = <K extends keyof CheckoutValues>(key: K, value: CheckoutValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const next = () => {
    const problems = validateStep(step, values);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    const i = CHECKOUT_STEPS.indexOf(step);
    setStep(CHECKOUT_STEPS[Math.min(i + 1, CHECKOUT_STEPS.length - 1)]!);
  };
  const back = () => {
    const i = CHECKOUT_STEPS.indexOf(step);
    setStep(CHECKOUT_STEPS[Math.max(i - 1, 0)]!);
  };

  const submit = async () => {
    for (const s of CHECKOUT_STEPS) {
      const problems = validateStep(s, values);
      if (Object.keys(problems).length > 0) {
        setErrors(problems);
        setStep(s);
        return;
      }
    }
    try {
      const order = await placeOrder.mutateAsync(toOrderPayload(values));
      if (order.payment?.checkout) {
        const result = await payWithRazorpay(
          order.payment.checkout,
          { name: order.contact_name, phone: order.contact_phone, email: order.contact_email },
          `Order ${order.order_number}`,
        ).catch(() => null);
        if (result) {
          const paid = await confirmPayment.mutateAsync({
            orderId: order.id,
            provider_payment_id: result.razorpay_payment_id,
            provider_order_id: result.razorpay_order_id,
            signature: result.razorpay_signature,
          });
          setPlaced(paid);
          return;
        }
        setPaymentNote(
          "Your order is reserved but the online payment wasn't completed. You can pay from your orders page or at the store.",
        );
      }
      setPlaced(order);
    } catch (error) {
      if (isApiError(error) && error.code === "payment_method_unavailable") {
        setOnlineUnavailable(true);
        set("payment_method", "pay_at_store");
        setStep("payment");
        toast({
          title: "Online payment isn't enabled yet",
          description: "Please choose pay at store to reserve your pieces.",
          tone: "info",
        });
        return;
      }
      toast({
        title: "Couldn't place your order",
        description: errorMessage(error),
        tone: "error",
      });
    }
  };

  if (session.isPending || cart.isPending) {
    return (
      <Section aria-busy="true">
        <Container>
          <Skeleton className="h-96 rounded-lg" />
        </Container>
      </Section>
    );
  }
  if (placed) {
    return (
      <Section>
        <Container className="max-w-xl text-center">
          <Check className="text-emerald mx-auto size-12" aria-hidden />
          <p className="eyebrow mt-4">Order {placed.order_number}</p>
          <h1 className="mt-2 text-4xl">
            {placed.status === "paid" ? "Payment received" : "Your pieces are reserved"}
          </h1>
          <p className="text-fg-muted mt-3">
            {placed.fulfilment_method === "store_pickup"
              ? `We'll have everything ready at ${placed.store_name ?? "the store"}. Bring this order number and pay there.`
              : "We'll confirm the day's gold rate and delivery details by phone before dispatch."}
          </p>
          {paymentNote && (
            <p className="border-gold/40 bg-gold/10 mt-4 rounded-sm border px-4 py-3 text-sm">
              {paymentNote}
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/account/orders/${placed.id}`}>View order</ButtonLink>
            <ButtonLink href="/products" variant="outline">
              Keep browsing
            </ButtonLink>
          </div>
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
            description="Orders are linked to your account so you can track them and bring them to the store. Your bag is kept."
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
  if (!cart.data || cart.data.items.length === 0) {
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
  const items = cart.data.items;
  const storeName = stores.data?.find((s) => s.id === values.store_id)?.name;

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container>
        <p className="eyebrow mb-2">Checkout</p>
        <h1 className="text-4xl md:text-5xl">Almost yours</h1>
        <div className="mt-6">
          <Stepper current={step} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "review") void submit();
            else next();
          }}
          noValidate
          className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]"
        >
          <div className="border-border bg-bg-elevated flex flex-col gap-6 rounded-lg border p-6 md:p-8">
            {step === "contact" && (
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 text-2xl">Who are we preparing this for?</legend>
                <Input
                  label="Full name"
                  required
                  autoComplete="name"
                  value={values.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                  error={errors.contact_name}
                />
                <Input
                  label="Phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={values.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value)}
                  error={errors.contact_phone}
                />
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  wrapperClassName="sm:col-span-2"
                  value={values.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                  error={errors.contact_email}
                />
              </fieldset>
            )}
            {step === "fulfilment" && (
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 text-2xl">How would you like to receive it?</legend>
                <Select
                  label="Collection"
                  wrapperClassName="sm:col-span-2"
                  value={values.fulfilment_method}
                  onChange={(e) => {
                    const method = e.target.value as CheckoutValues["fulfilment_method"];
                    set("fulfilment_method", method);
                    if (method === "delivery" && values.payment_method === "pay_at_store")
                      set("payment_method", "bank_transfer");
                  }}
                  options={[
                    { value: "store_pickup", label: "Collect in store (recommended)" },
                    { value: "delivery", label: "Insured home delivery" },
                  ]}
                />
                {values.fulfilment_method === "store_pickup" ? (
                  <Select
                    label="Store"
                    required
                    wrapperClassName="sm:col-span-2"
                    placeholder={stores.isPending ? "Loading stores…" : "Choose a store"}
                    value={values.store_id}
                    onChange={(e) => set("store_id", e.target.value)}
                    options={(stores.data ?? []).map((s) => ({
                      value: s.id,
                      label: `${s.name} — ${s.city}`,
                    }))}
                    error={
                      errors.store_id ??
                      (stores.data && stores.data.length === 0
                        ? "No stores are published yet. Choose delivery or contact us."
                        : undefined)
                    }
                  />
                ) : (
                  <>
                    <Input
                      label="Address"
                      required
                      autoComplete="address-line1"
                      wrapperClassName="sm:col-span-2"
                      value={values.address_line1}
                      onChange={(e) => set("address_line1", e.target.value)}
                      error={errors.address_line1}
                    />
                    <Input
                      label="Apartment, landmark"
                      autoComplete="address-line2"
                      wrapperClassName="sm:col-span-2"
                      value={values.address_line2}
                      onChange={(e) => set("address_line2", e.target.value)}
                    />
                    <Input
                      label="City"
                      required
                      autoComplete="address-level2"
                      value={values.city}
                      onChange={(e) => set("city", e.target.value)}
                      error={errors.city}
                    />
                    <Input
                      label="State"
                      required
                      autoComplete="address-level1"
                      value={values.state}
                      onChange={(e) => set("state", e.target.value)}
                      error={errors.state}
                    />
                    <Input
                      label="PIN code"
                      required
                      autoComplete="postal-code"
                      inputMode="numeric"
                      value={values.postal_code}
                      onChange={(e) => set("postal_code", e.target.value)}
                      error={errors.postal_code}
                    />
                  </>
                )}
              </fieldset>
            )}
            {step === "payment" && (
              <fieldset className="grid gap-4">
                <legend className="mb-3 text-2xl">How would you like to pay?</legend>
                <Select
                  label="Payment method"
                  value={values.payment_method}
                  onChange={(e) =>
                    set("payment_method", e.target.value as CheckoutValues["payment_method"])
                  }
                  options={[
                    ...(values.fulfilment_method === "store_pickup"
                      ? [{ value: "pay_at_store", label: "Pay at the store (reserve now)" }]
                      : []),
                    { value: "bank_transfer", label: "Bank transfer (details sent by the store)" },
                    {
                      value: "razorpay",
                      label: "Pay online (UPI, cards, net banking)",
                      disabled: onlineUnavailable,
                    },
                  ]}
                  hint={
                    onlineUnavailable
                      ? "Online payment is not enabled for this store yet. Reserve now and pay at the store or by bank transfer."
                      : "Online payment opens a secure page from our payment partner after you place the order."
                  }
                  error={errors.payment_method}
                />
                <Textarea
                  label="Notes for the store"
                  rows={3}
                  value={values.customer_notes}
                  onChange={(e) => set("customer_notes", e.target.value)}
                  error={errors.customer_notes}
                />
              </fieldset>
            )}
            {step === "review" && (
              <div className="flex flex-col gap-6">
                <h2 className="text-2xl">Review your order</h2>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-fg-muted text-xs tracking-wider uppercase">Contact</dt>
                    <dd className="mt-1">
                      {values.contact_name}
                      <br />
                      {values.contact_phone}
                      {values.contact_email && (
                        <>
                          <br />
                          {values.contact_email}
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-xs tracking-wider uppercase">Collection</dt>
                    <dd className="mt-1">
                      {values.fulfilment_method === "store_pickup"
                        ? `Collect at ${storeName ?? "the store"}`
                        : `Deliver to ${values.address_line1}, ${values.city} ${values.postal_code}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-xs tracking-wider uppercase">Payment</dt>
                    <dd className="mt-1">
                      {values.payment_method === "pay_at_store"
                        ? "Pay at the store"
                        : values.payment_method === "bank_transfer"
                          ? "Bank transfer"
                          : "Pay online"}
                    </dd>
                  </div>
                  {values.customer_notes && (
                    <div>
                      <dt className="text-fg-muted text-xs tracking-wider uppercase">Notes</dt>
                      <dd className="mt-1 whitespace-pre-line">{values.customer_notes}</dd>
                    </div>
                  )}
                </dl>
                <ul className="divide-border divide-y text-sm">
                  {items.map((c) => (
                    <li key={c.id} className="flex justify-between gap-3 py-3">
                      <span>
                        {c.product.name}
                        {c.quantity > 1 ? ` × ${c.quantity}` : ""}
                        {cartLineLabel(c) && (
                          <span className="text-fg-muted block text-xs">{cartLineLabel(c)}</span>
                        )}
                      </span>
                      <span className="tabular-nums">{formatPrice(c.line_total)}</span>
                    </li>
                  ))}
                </ul>
                <FormError error={placeOrder.error ?? confirmPayment.error} />
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-3">
              {step !== "contact" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={back}
                  leftIcon={<ChevronLeft className="size-4" aria-hidden />}
                >
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                size="lg"
                loading={placeOrder.isPending || confirmPayment.isPending}
              >
                {step === "review" ? "Place order" : "Continue"}
              </Button>
            </div>
          </div>
          <CartSummary
            subtotal={cart.data.subtotal}
            tax={cart.data.tax_total}
            total={cart.data.grand_total}
          >
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {items.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {c.product.name}
                    {c.quantity > 1 ? ` × ${c.quantity}` : ""}
                  </span>
                  <span className="tabular-nums">{formatPrice(c.line_total)}</span>
                </li>
              ))}
            </ul>
            <p className="text-fg-muted mt-4 text-xs">
              By placing an order you agree to the final price being confirmed on the day’s gold
              rate before payment is taken.
            </p>
          </CartSummary>
        </form>
      </Container>
    </Section>
  );
}
