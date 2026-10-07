"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { useCreateEnquiry, useProduct, useSession } from "@/lib/api/hooks";
import type { Enquiry } from "@/lib/api/types";
import { PHONE_PATTERN, applyApiFieldErrors } from "@/lib/forms";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  preferred_contact: z.enum(["phone", "whatsapp", "email"]),
});
type Values = z.infer<typeof schema>;

export interface EnquiryContext {
  productId?: string;
  productSlug?: string;
  lookToken?: string;
  savedLookId?: string;
}

/** The enquiry form itself; reused by the page and the product-page dialog. */
export function EnquiryFormCard({
  context,
  onSuccess,
  compact = false,
  initialMessage = "",
}: {
  context: EnquiryContext;
  onSuccess: (enquiry: Enquiry) => void;
  compact?: boolean;
  initialMessage?: string;
}) {
  const session = useSession();
  const send = useCreateEnquiry();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { preferred_contact: "phone", email: "", message: initialMessage },
  });
  useEffect(() => {
    if (session.data) {
      setValue("name", session.data.user.full_name);
      if (session.data.user.phone) setValue("phone", session.data.user.phone);
      if (session.data.user.email) setValue("email", session.data.user.email);
    }
  }, [session.data, setValue]);

  const submit = handleSubmit(async (v) => {
    try {
      const enquiry = await send.mutateAsync({
        name: v.name,
        phone: v.phone,
        email: v.email || undefined,
        message: v.message,
        preferred_contact: v.preferred_contact,
        product_id: context.productId,
        product_slug: context.productId ? undefined : context.productSlug,
        look_token: context.lookToken,
        saved_look_id: context.savedLookId,
      });
      onSuccess(enquiry);
    } catch (error) {
      applyApiFieldErrors(error, setError, ["name", "phone", "email", "message"]);
    }
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className={
        compact
          ? "grid gap-4"
          : "border-border bg-bg-elevated grid gap-4 rounded-lg border p-6 shadow-md md:p-8"
      }
    >
      <Input
        label="Name"
        required
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label="Phone"
        type="tel"
        required
        autoComplete="tel"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Textarea
        label="Your question"
        required
        rows={compact ? 4 : 5}
        error={errors.message?.message}
        {...register("message")}
      />
      <Select
        label="Preferred contact method"
        options={[
          { value: "phone", label: "Phone call" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "email", label: "Email" },
        ]}
        {...register("preferred_contact")}
      />
      <FormError error={send.error} />
      <Button type="submit" size="lg" loading={send.isPending}>
        Send enquiry
      </Button>
    </form>
  );
}

export function EnquirySuccess({
  reference,
  compact = false,
}: {
  reference: string;
  compact?: boolean;
}) {
  const body = (
    <>
      <CircleCheck className="text-emerald mx-auto size-12" aria-hidden />
      <h2 className={compact ? "mt-4 text-2xl" : "mt-4 text-4xl"}>
        Thank you — we&apos;ll be in touch
      </h2>
      <p className="text-fg-muted mt-3">
        Your enquiry reference is <strong>{reference}</strong>. A consultant will reply within one
        working day.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/products">Keep browsing</ButtonLink>
        <ButtonLink href="/account/enquiries" variant="outline">
          My enquiries
        </ButtonLink>
      </div>
    </>
  );
  if (compact) return <div className="text-center">{body}</div>;
  return (
    <Section>
      <Container className="max-w-xl text-center">{body}</Container>
    </Section>
  );
}

export function EnquiryForm({
  productSlug,
  lookToken,
}: {
  productSlug?: string;
  lookToken?: string;
}) {
  const product = useProduct(productSlug ?? "");
  const [done, setDone] = useState<string | null>(null);
  if (done) return <EnquirySuccess reference={done} />;

  return (
    <Section padding="sm" className="pt-10 md:pt-16">
      <Container className="grid gap-12 lg:grid-cols-[1fr_minmax(0,32rem)]">
        <div className="max-w-lg">
          <p className="eyebrow mb-2 inline-flex items-center gap-2">
            <MessageCircle className="size-4" aria-hidden /> Enquiry
          </p>
          <h1 className="text-4xl md:text-5xl">
            {lookToken ? "Ask about this look" : "Ask about this jewellery"}
          </h1>
          <p className="text-fg-muted mt-4">
            Weight, purity, customisation, delivery timelines or price on today&apos;s gold rate —
            ask anything and a consultant will answer personally.
          </p>
          {productSlug && (
            <div className="border-border bg-bg-elevated mt-8 flex gap-4 rounded-lg border p-4">
              <div className="bg-bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
                {product.data?.primary_image ? (
                  <Image
                    src={product.data.primary_image.url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <ProductImagePlaceholder />
                )}
              </div>
              <div className="min-w-0">
                {product.data ? (
                  <>
                    <Link
                      href={`/products/${product.data.slug}`}
                      className="hover:text-accent-text font-medium"
                    >
                      {product.data.name}
                    </Link>
                    <Price price={product.data.price} size="sm" className="mt-1" />
                  </>
                ) : (
                  <p className="text-fg-muted text-sm">
                    {product.isPending ? "Loading piece…" : "Enquiring about: " + productSlug}
                  </p>
                )}
              </div>
            </div>
          )}
          {lookToken && (
            <p className="border-gold/40 bg-gold/10 mt-6 rounded-sm border px-4 py-3 text-sm">
              Your question will be linked to the shared look so the consultant sees every piece in
              it.
            </p>
          )}
        </div>
        <EnquiryFormCard
          context={{ productId: product.data?.id, productSlug, lookToken }}
          onSuccess={(e) => setDone(e.reference)}
        />
      </Container>
    </Section>
  );
}
