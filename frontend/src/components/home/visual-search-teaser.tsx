import { ScanSearch } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";

export function VisualSearchTeaser() {
  return (
    <Section tone="muted">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow mb-3">Visual Search</p>
          <h2 className="text-4xl md:text-5xl">Seen something you love? Find it here.</h2>
          <p className="text-fg-muted mt-5 max-w-lg text-pretty">
            Upload a screenshot, a magazine photo or a picture of a family heirloom. We compare it
            with every piece in the shop and show exact and similar matches with live prices and
            availability.
          </p>
          <ButtonLink
            href="/visual-search"
            size="lg"
            className="mt-8"
            leftIcon={<ScanSearch className="size-5" aria-hidden />}
          >
            Search by image
          </ButtonLink>
        </Reveal>
        <Reveal direction="left">
          <div className="relative mx-auto grid max-w-md grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`border-border bg-bg-elevated aspect-square rounded-md border ${i === 0 ? "border-gold col-span-2 row-span-2" : ""}`}
                aria-hidden
              >
                <div className="flex size-full items-center justify-center">
                  <svg
                    viewBox="0 0 40 40"
                    className={i === 0 ? "text-gold w-20" : "text-gold/60 w-10"}
                  >
                    <circle
                      cx="20"
                      cy="22"
                      r="10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    />
                    <polygon points="20,4 25,10 20,16 15,10" fill="currentColor" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
