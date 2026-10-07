"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Technical detail stays in the console / monitoring, never in the UI.
    console.error("[jewelora] route error", error.digest ?? error.message);
  }, [error]);

  return (
    <Section padding="lg">
      <Container className="max-w-xl text-center">
        <p className="eyebrow mb-3">Something went wrong</p>
        <h1 className="text-4xl md:text-5xl">We couldn&apos;t show this page</h1>
        <p className="text-fg-muted mt-4">
          Please try again. If the problem continues, our team can help you in store or over the
          phone.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={retry}>Try again</Button>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
        {error.digest && <p className="text-fg-muted mt-6 text-xs">Reference: {error.digest}</p>}
      </Container>
    </Section>
  );
}
