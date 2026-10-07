import { BadgeCheck, Lock, ShieldCheck, Store } from "lucide-react";
import { Container, Section } from "@/components/ui/layout";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "BIS hallmarked",
    text: "Every gold piece carries a BIS hallmark and purity certificate.",
  },
  {
    icon: BadgeCheck,
    title: "Certified stones",
    text: "Diamonds come with IGI or GIA certificates; coloured stones with lab reports.",
  },
  {
    icon: Lock,
    title: "Your photos are private",
    text: "Try-on photos are encrypted, never shared, and deleted on request.",
  },
  {
    icon: Store,
    title: "Showroom-backed",
    text: "See, weigh and verify any piece in store before you pay.",
  },
];

export function Trust() {
  return (
    <Section tone="muted" padding="sm">
      <Container>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((it) => (
            <li key={it.title} className="flex gap-4">
              <span className="border-gold/40 text-accent-text inline-flex size-11 shrink-0 items-center justify-center rounded-full border">
                <it.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{it.title}</p>
                <p className="text-fg-muted mt-1 text-sm">{it.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
