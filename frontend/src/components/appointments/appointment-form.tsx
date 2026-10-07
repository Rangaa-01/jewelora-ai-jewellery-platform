"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Calendar, CircleCheck } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { api } from "@/lib/api/client";
import { useSession, useStores } from "@/lib/api/hooks";
import { PHONE_PATTERN, applyApiFieldErrors } from "@/lib/forms";

const schema = z.object({
  guest_name: z.string().trim().min(2, "Enter your name"),
  guest_phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
  guest_email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  store_id: z.string().min(1, "Choose a store"),
  date: z.string().min(1, "Choose a date"),
  time: z.string().min(1, "Choose a time"),
  party_size: z
    .number({ error: "Enter how many people" })
    .int()
    .min(1, "At least 1")
    .max(10, "Up to 10 people"),
  purpose: z.enum(["browse", "bridal", "tryon_pieces", "pickup", "repair"]),
  notes: z.string().trim().max(1000),
});
type Values = z.infer<typeof schema>;

interface AppointmentOut {
  id: string;
  reference: string;
  starts_at: string;
  store: { name: string };
}

const TIMES = Array.from({ length: 18 }, (_, i) => {
  const h = 10 + Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export function AppointmentForm({
  productSlugs,
  lookToken,
}: {
  productSlugs: string[];
  lookToken?: string;
}) {
  const stores = useStores();
  const session = useSession();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      party_size: 1,
      purpose: productSlugs.length ? "tryon_pieces" : "browse",
      notes: "",
      guest_email: "",
      store_id: "",
      date: "",
      time: "",
    },
  });
  useEffect(() => {
    if (session.data) {
      setValue("guest_name", session.data.user.full_name);
      if (session.data.user.phone) setValue("guest_phone", session.data.user.phone);
      if (session.data.user.email) setValue("guest_email", session.data.user.email);
    }
  }, [session.data, setValue]);
  useEffect(() => {
    const first = stores.data?.[0];
    if (first) setValue("store_id", first.id);
  }, [stores.data, setValue]);

  const book = useMutation({
    mutationFn: (v: Values) =>
      api.post<AppointmentOut>("/appointments", {
        guest_name: v.guest_name,
        guest_phone: v.guest_phone,
        guest_email: v.guest_email || undefined,
        store_id: v.store_id,
        starts_at: new Date(`${v.date}T${v.time}:00`).toISOString(),
        party_size: v.party_size,
        purpose: v.purpose,
        notes: v.notes || undefined,
        product_slugs: productSlugs,
        look_token: lookToken,
      }),
    onError: (error) =>
      applyApiFieldErrors(error, setError, [
        "guest_name",
        "guest_phone",
        "guest_email",
        "store_id",
        "date",
        "time",
        "party_size",
        "notes",
      ]),
  });

  const today = new Date();
  const minDate = new Date(today.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const noStores = stores.data && stores.data.length === 0;

  if (book.data) {
    return (
      <Section>
        <Container className="max-w-xl text-center">
          <CircleCheck className="text-emerald mx-auto size-12" aria-hidden />
          <h1 className="mt-4 text-4xl">Appointment requested</h1>
          <p className="text-fg-muted mt-3">
            Reference <strong>{book.data.reference}</strong> at {book.data.store.name}. We&apos;ll
            confirm by phone or WhatsApp shortly.
          </p>
          <div className="mt-8 flex justify-center gap-3">
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
      <Container className="grid gap-12 lg:grid-cols-[1fr_minmax(0,32rem)]">
        <div className="max-w-lg">
          <p className="eyebrow mb-2 inline-flex items-center gap-2">
            <Calendar className="size-4" aria-hidden /> Store appointment
          </p>
          <h1 className="text-4xl md:text-5xl">Book a private showroom visit</h1>
          <p className="text-fg-muted mt-4">
            A consultant will prepare the pieces you’ve tried on or saved, with accurate sizing,
            hallmark details and the day’s pricing.
          </p>
          {productSlugs.length > 0 && (
            <p className="border-gold/40 bg-gold/10 mt-6 rounded-sm border px-4 py-3 text-sm">
              We’ll have <strong>{productSlugs.length}</strong> selected{" "}
              {productSlugs.length === 1 ? "piece" : "pieces"} ready for you.
            </p>
          )}
        </div>
        <form
          onSubmit={handleSubmit((v) => book.mutate(v))}
          noValidate
          className="border-border bg-bg-elevated grid gap-4 rounded-lg border p-6 shadow-md sm:grid-cols-2 md:p-8"
        >
          <Input
            label="Your name"
            required
            autoComplete="name"
            error={errors.guest_name?.message}
            {...register("guest_name")}
          />
          <Input
            label="Phone"
            type="tel"
            required
            autoComplete="tel"
            error={errors.guest_phone?.message}
            {...register("guest_phone")}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            wrapperClassName="sm:col-span-2"
            error={errors.guest_email?.message}
            {...register("guest_email")}
          />
          <Select
            label="Store"
            required
            wrapperClassName="sm:col-span-2"
            placeholder={stores.isPending ? "Loading stores…" : "Choose a store"}
            options={(stores.data ?? []).map((s) => ({
              value: s.id,
              label: `${s.name} — ${s.city}`,
            }))}
            error={
              errors.store_id?.message ??
              (noStores
                ? "Store locations aren’t published yet. Please call us to book."
                : undefined)
            }
            {...register("store_id")}
          />
          <Input
            label="Date"
            type="date"
            required
            min={minDate}
            error={errors.date?.message}
            {...register("date")}
          />
          <Select
            label="Time"
            required
            placeholder="Choose a time"
            options={TIMES.map((t) => ({ value: t, label: t }))}
            error={errors.time?.message}
            {...register("time")}
          />
          <Input
            label="Number of people"
            type="number"
            min={1}
            max={10}
            required
            error={errors.party_size?.message}
            {...register("party_size", { valueAsNumber: true })}
          />
          <Select
            label="Purpose"
            options={[
              { value: "browse", label: "Browse the collection" },
              { value: "tryon_pieces", label: "Try my selected pieces" },
              { value: "bridal", label: "Bridal consultation" },
              { value: "pickup", label: "Collect an order" },
              { value: "repair", label: "Repair or resizing" },
            ]}
            {...register("purpose")}
          />
          <Textarea
            label="Notes"
            rows={3}
            wrapperClassName="sm:col-span-2"
            hint="Occasion, budget, sizes or anything we should prepare."
            error={errors.notes?.message}
            {...register("notes")}
          />
          <div className="sm:col-span-2">
            <FormError error={book.error} />
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
