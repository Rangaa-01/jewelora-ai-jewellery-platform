import type { ReactNode } from "react";
import { Container, Section } from "@/components/ui/layout";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Section padding="md">
      <Container className="grid gap-12 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-start">
        <div className="max-w-lg">
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h1 className="text-4xl md:text-5xl">{title}</h1>
          <p className="text-fg-muted mt-4">{description}</p>
          <ul className="text-fg-soft mt-8 flex flex-col gap-3 text-sm">
            <li>· Saved looks and wishlist synced across devices</li>
            <li>· Appointments, enquiries and orders in one place</li>
            <li>· Photos stay private and can be deleted at any time</li>
          </ul>
        </div>
        <div className="border-border bg-bg-elevated rounded-lg border p-6 shadow-md md:p-8">
          {children}
        </div>
      </Container>
    </Section>
  );
}
