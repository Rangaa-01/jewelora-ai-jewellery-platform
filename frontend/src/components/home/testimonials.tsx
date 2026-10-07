import { Quote } from "lucide-react";
import { Reveal } from "@/components/motion";
import { Container, Section, SectionHeading } from "@/components/ui/layout";
import { testimonials } from "@/content/testimonials";

export function Testimonials() {
  if (testimonials.length === 0) return null;
  return (
    <Section>
      <Container>
        <SectionHeading eyebrow="Testimonials" title="What our clients say" />
        <ul className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08} as="li">
              <figure className="border-border bg-bg-elevated flex h-full flex-col rounded-lg border p-7">
                <Quote className="text-gold size-6" aria-hidden />
                <blockquote className="font-display text-fg mt-4 flex-1 text-xl leading-relaxed">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-fg-muted">
                    {" "}
                    · {t.city} · {t.context}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
