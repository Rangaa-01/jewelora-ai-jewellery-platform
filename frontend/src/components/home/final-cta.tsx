import { Camera } from "lucide-react";
import { Reveal, Sparkle } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";

export function FinalCta() {
  return (
    <Section
      padding="lg"
      className="overflow-hidden bg-[radial-gradient(80%_80%_at_50%_100%,var(--color-ivory-soft),var(--bg))] dark:bg-[radial-gradient(80%_80%_at_50%_100%,var(--bg-muted),var(--bg))]"
    >
      <Sparkle count={24} className="opacity-60" />
      <Container className="relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-4xl text-balance md:text-6xl">
            The right piece is the one you&apos;ve already seen on yourself
          </h2>
          <p className="text-fg-muted mx-auto mt-5 max-w-xl">
            Start with a photo. Finish with certainty.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <ButtonLink
              href="/try-on"
              size="lg"
              leftIcon={<Camera className="size-5" aria-hidden />}
            >
              Try It On
            </ButtonLink>
            <ButtonLink href="/appointments/new" size="lg" variant="outline">
              Book a Visit
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
