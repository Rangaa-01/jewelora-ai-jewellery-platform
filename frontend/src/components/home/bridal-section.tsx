import { Crown } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";

const PIECES = [
  "Necklace",
  "Long haram",
  "Earrings",
  "Maang tikka",
  "Nose ring",
  "Bangles",
  "Vaddanam",
  "Rings",
  "Anklets",
];

export function BridalSection() {
  return (
    <Section className="bg-[linear-gradient(180deg,var(--color-rose-gold-soft),var(--bg))] dark:bg-[linear-gradient(180deg,var(--bg-muted),var(--bg))]">
      <Container className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal direction="right" className="order-2 lg:order-1">
          <div className="border-gold/30 bg-bg-elevated relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-lg border shadow-lg">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(228,199,127,0.35),transparent_60%)]"
            />
            <div className="absolute inset-x-0 top-10 flex justify-center">
              <svg viewBox="0 0 200 200" className="w-40" aria-hidden>
                <circle cx="100" cy="70" r="36" fill="none" stroke="#c6a15b" strokeWidth="1.5" />
                <path
                  d="M30 150c20-40 50-50 70-50s50 10 70 50"
                  fill="none"
                  stroke="#c6a15b"
                  strokeWidth="2"
                />
                <path d="M60 135q40 40 80 0" fill="none" stroke="#8a6a2b" strokeWidth="3" />
                <circle cx="100" cy="158" r="5" fill="#e4c77f" />
                <path d="M100 34v-14" stroke="#8a6a2b" strokeWidth="2" />
                <circle cx="100" cy="18" r="4" fill="#e4c77f" />
                <circle cx="64" cy="82" r="3" fill="#e4c77f" />
                <circle cx="136" cy="82" r="3" fill="#e4c77f" />
              </svg>
            </div>
            <ul className="absolute inset-x-6 bottom-6 flex flex-wrap gap-1.5">
              {PIECES.map((p) => (
                <li
                  key={p}
                  className="border-gold/40 bg-bg text-gold-ink dark:text-gold-bright rounded-full border px-2.5 py-1 text-[0.7rem] tracking-wider uppercase"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal className="order-1 lg:order-2">
          <p className="eyebrow mb-3 inline-flex items-center gap-2">
            <Crown className="size-4" aria-hidden /> Bridal Collection
          </p>
          <h2 className="text-4xl md:text-5xl">
            Your complete bridal look, on you, before the big day
          </h2>
          <p className="text-fg-muted mt-5 max-w-lg text-pretty">
            Bridal mode layers every piece — from maang tikka to anklets — on a single photo so you
            can see the full ensemble together, save it, share it with family and bring it to your
            appointment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/bridal" size="lg">
              Create My Bridal Look
            </ButtonLink>
            <ButtonLink href="/collections?bridal=true" size="lg" variant="outline">
              Bridal collections
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
