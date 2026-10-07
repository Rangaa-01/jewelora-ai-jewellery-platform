"use client";

import { ArrowRight, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";

const EXAMPLES = [
  "Traditional gold jewellery for a wedding under ₹2 lakh",
  "Minimal diamond earrings for office wear",
  "Rose gold bracelet to match a pastel lehenga",
];

export function StylistTeaser() {
  const [q, setQ] = useState("");
  const router = useRouter();
  const go = (text: string) => router.push(`/stylist?q=${encodeURIComponent(text)}`);
  return (
    <Section tone="elevated">
      <Container className="max-w-4xl">
        <SectionHeading
          eyebrow="AI Stylist"
          title="Tell us the occasion. We’ll pick from the shop."
          description="Describe your event, outfit and budget. The stylist only suggests pieces that are actually in our catalogue and in stock."
        />
        <Reveal>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) go(q.trim());
            }}
            className="border-border bg-bg flex flex-col gap-3 rounded-lg border p-3 shadow-md sm:flex-row"
          >
            <label htmlFor="stylist-q" className="sr-only">
              Describe what you’re looking for
            </label>
            <div className="relative flex-1">
              <WandSparkles
                className="text-accent-text pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                aria-hidden
              />
              <input
                id="stylist-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="I have a wedding next month and want…"
                className="placeholder:text-fg-muted/70 focus-visible:outline-ring h-12 w-full rounded-sm bg-transparent pr-3 pl-10 text-base focus-visible:outline-2 focus-visible:outline-offset-0"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              rightIcon={<ArrowRight className="size-4" aria-hidden />}
              disabled={!q.trim()}
            >
              Ask the stylist
            </Button>
          </form>
        </Reveal>
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => go(ex)}
                className="border-border text-fg-soft hover:border-gold hover:text-fg inline-flex min-h-10 items-center rounded-full border px-4 text-sm"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
