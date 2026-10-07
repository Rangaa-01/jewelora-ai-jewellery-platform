"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ProductImagePlaceholder } from "@/components/catalogue/product-card";
import { FormError } from "@/components/forms/form-error";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Container, Section } from "@/components/ui/layout";
import { Price } from "@/components/ui/price";
import { api } from "@/lib/api/client";
import { useProduct, useSession } from "@/lib/api/hooks";
import { PHONE_PATTERN, applyApiFieldErrors } from "@/lib/forms";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  preferred_contact: z.enum(["phone", "whatsapp", "email"]),
});
type Values = z.infer<typeof schema>;

export function EnquiryForm({ productSlug }: { productSlug?: string }) {
  const product = useProduct(productSlug ?? "");
  const session = useSession();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { preferred_contact: "phone", email: "", message: "" },
  });
  useEffect(() => {
    if (session.data) {
      setValue("name", session.data.user.full_name);
      if (session.data.user.phone) setValue("phone", session.data.user.phone);
      if (session.data.user.email) setValue("email", session.data.user.email);
    }
  }, [session.data, setValue]);

  const send = useMutation({
    mutationFn: (v: Values) =>
      api.post<{ id: string; reference: string }>("/enquiries", {
        ...v,
        email: v.email || undefined,
        product_id: product.data?.id,
      }),
    onError: (error) => applyApiFieldErrors(error, setError, ["name", "phone", "email", "message"]),
  });

  if (send.data) {
    return (
      <Section>
        <Container className="max-w-xl text-center">
          <CircleCheck className="text-emerald mx-auto size-12" aria-hidden />
          <h1 className="mt-4 text-4xl">Thank you — we&apos;ll be in touch</h1>
          <p className="text-fg-muted mt-3">
            Your enquiry reference is <strong>{send.data.reference}</strong>. A consultant will
            reply within one working day.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <ButtonLink href="/products">Keep browsing</ButtonLink>
            <ButtonLink href="/account/enquiries" variant="outline">
              My enquiries
            </ButtonLink>
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
            <MessageCircle className="size-4" aria-hidden /> Enquiry
          </p>
          <h1 className="text-4xl md:text-5xl">Ask about this jewellery</h1>
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
        </div>
        <form
          onSubmit={handleSubmit((v) => send.mutate(v))}
          noValidate
          className="border-border bg-bg-elevated grid gap-4 rounded-lg border p-6 shadow-md md:p-8"
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
            rows={5}
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
      </Container>
    </Section>
  );
}
