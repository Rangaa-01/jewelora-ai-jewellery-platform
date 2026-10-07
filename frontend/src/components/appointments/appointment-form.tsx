"use client";

import { useQueries } from "@tanstack/react-query";
import { Calendar, CircleCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { api, isApiError } from "@/lib/api/client";
import {
  queryKeys,
  useAppointmentSlots,
  useBookAppointment,
  useSession,
  useStores,
} from "@/lib/api/hooks";
import type { Appointment, ProductDetail } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { PHONE_PATTERN } from "@/lib/forms";
import { cn } from "@/lib/utils";

interface Values {
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  store_id: string;
  date: string;
  starts_at: string;
  party_size: number;
  purpose: string;
  notes: string;
}

type Errors = Partial<Record<keyof Values, string>>;

function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validate(v: Values): Errors {
  const e: Errors = {};
  if (v.guest_name.trim().length < 2) e.guest_name = "Enter your name";
  if (!PHONE_PATTERN.test(v.guest_phone.trim())) e.guest_phone = "Enter a valid phone number";
  if (v.guest_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.guest_email.trim()))
    e.guest_email = "Enter a valid email";
  if (!v.store_id) e.store_id = "Choose a store";
  if (!v.date) e.date = "Choose a date";
  if (!v.starts_at) e.starts_at = "Choose a time";
  if (!Number.isInteger(v.party_size) || v.party_size < 1 || v.party_size > 12)
    e.party_size = "Between 1 and 12 people";
  if (v.notes.length > 2000) e.notes = "Keep notes under 2000 characters";
  return e;
}

function ProductChips({ slugs }: { slugs: string[] }) {
  const products = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: queryKeys.product(slug),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { signal }),
      staleTime: 60_000,
      retry: false,
    })),
  });
  if (slugs.length === 0) return null;
  return (
    <div className="border-gold/40 bg-gold/10 mt-6 rounded-sm border px-4 py-3 text-sm">
      <p>
        We’ll have <strong>{slugs.length}</strong> selected{" "}
        {slugs.length === 1 ? "piece" : "pieces"} ready for you:
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {products.map((q, i) => (
          <li key={slugs[i]}>
            {q.data ? (
              <Link
                href={`/products/${q.data.slug}`}
                className="bg-bg-elevated border-border hover:border-gold inline-flex min-h-9 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs"
              >
                <span className="bg-bg-muted relative size-7 overflow-hidden rounded-full">
                  {q.data.primary_image ? (
                    <Image
                      src={q.data.primary_image.url}
                      alt=""
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  ) : (
                    <ProductImagePlaceholder />
                  )}
                </span>
                {q.data.name}
              </Link>
            ) : (
              <span className="text-fg-muted inline-flex min-h-9 items-center text-xs">
                {q.isPending ? "Loading…" : slugs[i]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlotGrid({
  storeId,
  date,
  value,
  onChange,
  error,
}: {
  storeId: string;
  date: string;
  value: string;
  onChange: (startsAt: string) => void;
  error?: string;
}) {
  const slots = useAppointmentSlots(storeId || null, date || null);
  const fmt = useMemo(
    () => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }),
    [],
  );
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-fg-soft mb-2 text-sm font-medium">
        Time{" "}
        <span className="text-danger" aria-hidden>
          *
        </span>
      </legend>
      {!storeId || !date ? (
        <p className="text-fg-muted text-sm">Choose a store and a date to see available times.</p>
      ) : slots.isPending ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : slots.error ? (
        <FormError error={slots.error} />
      ) : slots.data.every((s) => !s.available) ? (
        <p className="text-fg-muted text-sm">No times left on this day — try another date.</p>
      ) : (
        <div
          className="grid grid-cols-4 gap-2 sm:grid-cols-6"
          role="radiogroup"
          aria-label="Available times"
        >
          {slots.data.map((slot) => {
            const selected = slot.starts_at === value;
            return (
              <button
                key={slot.starts_at}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!slot.available}
                onClick={() => onChange(slot.starts_at)}
                className={cn(
                  "min-h-11 rounded-sm border text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  selected
                    ? "border-gold-deep bg-gold/15 font-medium"
                    : "border-border hover:border-fg",
                )}
              >
                {fmt.format(new Date(slot.starts_at))}
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function AppointmentForm({
  productSlugs,
  lookToken,
}: {
  productSlugs: string[];
  lookToken?: string;
}) {
  const stores = useStores();
  const session = useSession();
  const book = useBookAppointment();
  const [values, setValues] = useState<Values>({
    guest_name: "",
    guest_phone: "",
    guest_email: "",
    store_id: "",
    date: localDate(1),
    starts_at: "",
    party_size: 1,
    purpose: productSlugs.length ? "tryon_pieces" : lookToken ? "bridal" : "browse",
    notes: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<Appointment | null>(null);

  // Seed from the session and the store list once (render-phase derived state).
  const [seeded, setSeeded] = useState({ session: false, stores: false });
  if (!seeded.session && session.data) {
    setSeeded((x) => ({ ...x, session: true }));
    const u = session.data.user;
    setValues((v) => ({
      ...v,
      guest_name: v.guest_name || u.full_name,
      guest_phone: v.guest_phone || (u.phone ?? ""),
      guest_email: v.guest_email || (u.email ?? ""),
    }));
  }
  if (!seeded.stores && stores.data && stores.data.length > 0) {
    setSeeded((x) => ({ ...x, stores: true }));
    const first = stores.data[0]!;
    setValues((v) => (v.store_id ? v : { ...v, store_id: first.id }));
  }

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({
      ...v,
      [key]: value,
      ...(key === "store_id" || key === "date" ? { starts_at: "" } : {}),
    }));
    setErrors((e) => ({
      ...e,
      [key]: undefined,
      ...(key === "store_id" || key === "date" ? { starts_at: undefined } : {}),
    }));
  };

  const submit = async () => {
    const problems = validate(values);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    try {
      const appointment = await book.mutateAsync({
        store_id: values.store_id,
        starts_at: values.starts_at,
        guest_name: values.guest_name.trim(),
        guest_phone: values.guest_phone.trim(),
        guest_email: values.guest_email.trim() || undefined,
        party_size: values.party_size,
        purpose: values.purpose,
        notes: values.notes.trim() || undefined,
        product_slugs: productSlugs,
        look_token: lookToken,
      });
      setResult(appointment);
    } catch (error) {
      if (isApiError(error)) {
        if (error.code === "slot_full") setErrors({ starts_at: error.message });
        else if (error.code === "too_soon" || error.code === "too_far")
          setErrors({ date: error.message });
        for (const fe of error.fieldErrors) {
          const key = fe.field.split(".").pop() as keyof Values;
          if (key in values) setErrors((e) => ({ ...e, [key]: fe.message }));
        }
      }
    }
  };

  const noStores = stores.data && stores.data.length === 0;

  if (result) {
    return (
      <Section>
        <Container className="max-w-xl text-center">
          <CircleCheck className="text-emerald mx-auto size-12" aria-hidden />
          <h1 className="mt-4 text-4xl">Appointment requested</h1>
          <p className="text-fg-muted mt-3">
            Reference <strong>{result.reference}</strong> ·{" "}
            {formatDate(result.starts_at, { dateStyle: "full", timeStyle: "short" })} at{" "}
            {result.store.name}. We&apos;ll confirm by phone or WhatsApp shortly.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/account/appointments" variant="outline">
              My appointments
            </ButtonLink>
            <ButtonLink href="/products">Keep browsing</ButtonLink>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="grid gap-12 lg:grid-cols-[1fr_minmax(0,34rem)]">
        <div className="max-w-lg">
          <p className="eyebrow mb-2 inline-flex items-center gap-2">
            <Calendar className="size-4" aria-hidden /> Store appointment
          </p>
          <h1 className="text-4xl md:text-5xl">Book a private showroom visit</h1>
          <p className="text-fg-muted mt-4">
            A consultant will prepare the pieces you’ve tried on or saved, with accurate sizing,
            hallmark details and the day’s pricing.
          </p>
          <ProductChips slugs={productSlugs} />
          {lookToken && (
            <p className="border-gold/40 bg-gold/10 mt-4 rounded-sm border px-4 py-3 text-sm">
              Your shared look will be attached so every piece in it is ready to try.
            </p>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
          className="border-border bg-bg-elevated grid gap-4 rounded-lg border p-6 shadow-md sm:grid-cols-2 md:p-8"
        >
          <Input
            label="Your name"
            required
            autoComplete="name"
            value={values.guest_name}
            onChange={(e) => set("guest_name", e.target.value)}
            error={errors.guest_name}
          />
          <Input
            label="Phone"
            type="tel"
            required
            autoComplete="tel"
            value={values.guest_phone}
            onChange={(e) => set("guest_phone", e.target.value)}
            error={errors.guest_phone}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            wrapperClassName="sm:col-span-2"
            value={values.guest_email}
            onChange={(e) => set("guest_email", e.target.value)}
            error={errors.guest_email}
          />
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
              (noStores
                ? "Store locations aren’t published yet. Please call us to book."
                : undefined)
            }
          />
          <Input
            label="Date"
            type="date"
            required
            min={localDate(0)}
            max={localDate(90)}
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            error={errors.date}
          />
          <Input
            label="Number of people"
            type="number"
            min={1}
            max={12}
            required
            value={values.party_size}
            onChange={(e) => set("party_size", Number(e.target.value))}
            error={errors.party_size}
          />
          <SlotGrid
            storeId={values.store_id}
            date={values.date}
            value={values.starts_at}
            onChange={(s) => set("starts_at", s)}
            error={errors.starts_at}
          />
          <Select
            label="Purpose"
            wrapperClassName="sm:col-span-2"
            value={values.purpose}
            onChange={(e) => set("purpose", e.target.value)}
            options={[
              { value: "browse", label: "Browse the collection" },
              { value: "tryon_pieces", label: "Try my selected pieces" },
              { value: "bridal", label: "Bridal consultation" },
              { value: "pickup", label: "Collect an order" },
              { value: "repair", label: "Repair or resizing" },
            ]}
          />
          <Textarea
            label="Notes"
            rows={3}
            wrapperClassName="sm:col-span-2"
            hint="Occasion, budget, sizes or anything we should prepare."
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            error={errors.notes}
          />
          <div className="sm:col-span-2">
            <FormError error={book.error && !isApiError(book.error) ? book.error : null} />
            {isApiError(book.error) &&
              !["slot_full", "too_soon", "too_far", "validation_error"].includes(
                book.error.code,
              ) && <FormError error={book.error} />}
          </div>
          <Button
            type="submit"
            size="lg"
            className="sm:col-span-2"
            loading={book.isPending}
            disabled={!!noStores}
          >
            Request appointment
          </Button>
        </form>
      </Container>
    </Section>
  );
}
