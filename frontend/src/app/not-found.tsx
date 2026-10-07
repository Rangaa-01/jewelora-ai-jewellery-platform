import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";

export default function NotFound() {
  return (
    <Section padding="lg">
      <Container className="max-w-xl text-center">
        <p className="eyebrow mb-3">404</p>
        <h1 className="text-4xl md:text-5xl">This page isn&apos;t in our collection</h1>
        <p className="text-fg-muted mt-4">
          The link may have changed or the piece may no longer be available.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/products">Browse jewellery</ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
