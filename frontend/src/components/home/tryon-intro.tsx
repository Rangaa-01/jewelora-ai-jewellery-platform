import { Camera, ImagePlus, Lock, Move } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";

const POINTS = [
  {
    icon: ImagePlus,
    title: "Upload a photo",
    text: "Our AI finds your face, ears, neck, hands and wrists and places each piece to scale with natural lighting and shadow.",
  },
  {
    icon: Camera,
    title: "Or go live",
    text: "Open your camera and jewellery follows you as you move. Everything runs on your device — no video is uploaded.",
  },
  {
    icon: Move,
    title: "Adjust & mix",
    text: "Nudge, resize or rotate any piece, swap metals and stones, and build a complete look from necklace to anklet.",
  },
  {
    icon: Lock,
    title: "Private by design",
    text: "Photos are private, visible only to you, and deleted on request or automatically after 30 days.",
  },
];

export function TryOnIntro() {
  return (
    <Section id="tryon-intro" tone="elevated">
      <Container>
        <SectionHeading
          eyebrow="AI Virtual Try-On"
          title="See it on you, not on a model"
          description="Jewelora's try-on engine fits every piece to your own proportions, so the necklace that looks right on screen looks right in the mirror."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <article className="border-border bg-bg flex h-full flex-col rounded-lg border p-6 transition-shadow hover:shadow-md">
                <span className="bg-gold/15 text-accent-text mb-5 inline-flex size-11 items-center justify-center rounded-full">
                  <p.icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-sans text-lg font-semibold">{p.title}</h3>
                <p className="text-fg-muted mt-2 text-sm leading-relaxed">{p.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <ButtonLink href="/try-on" size="lg">
            Start a try-on
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
