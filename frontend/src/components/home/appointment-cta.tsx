"use client";

import { Calendar, MapPin, Phone } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { useStores } from "@/lib/api/hooks";

export function AppointmentCta() {
  const { data: stores } = useStores();
  const list = (stores ?? []).slice(0, 3);
  return (
    <Section tone="inverse">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow !text-gold-bright mb-3">Store Appointment</p>
          <h2 className="text-ivory text-4xl md:text-5xl">Bring your look to the showroom</h2>
          <p className="text-ivory/75 mt-5 max-w-lg text-pretty">
            Book a private appointment with a jewellery consultant. We’ll have the pieces from your
            saved looks ready to try, with sizing, hallmark details and pricing on the day’s gold
            rate.
          </p>
          <ButtonLink
            href="/appointments/new"
            size="lg"
            className="mt-8"
            leftIcon={<Calendar className="size-5" aria-hidden />}
          >
            Book a Visit
          </ButtonLink>
        </Reveal>
        <div className="grid gap-4">
          {list.length > 0 ? (
            list.map((s) => (
              <Reveal key={s.id} direction="left">
                <address className="border-ivory/15 bg-ivory/5 rounded-lg border p-5 not-italic">
                  <p className="font-display text-ivory text-xl">{s.name}</p>
                  <p className="text-ivory/75 mt-1 flex items-start gap-2 text-sm">
                    <MapPin className="text-gold-bright mt-0.5 size-4 shrink-0" aria-hidden />{" "}
                    {s.address_line1}, {s.city}
                  </p>
                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="text-gold-bright mt-2 inline-flex min-h-10 items-center gap-2 text-sm hover:underline"
                    >
                      <Phone className="size-4" aria-hidden /> {s.phone}
                    </a>
                  )}
                </address>
              </Reveal>
            ))
          ) : (
            <Reveal direction="left">
              <div className="border-ivory/15 bg-ivory/5 text-ivory/75 rounded-lg border p-5 text-sm">
                Store locations and opening hours appear here once the shop publishes them. You can
                still request an appointment and we’ll confirm the branch by phone.
              </div>
            </Reveal>
          )}
        </div>
      </Container>
    </Section>
  );
}
