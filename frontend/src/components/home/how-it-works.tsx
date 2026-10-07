"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/ui/layout";

const STEPS = [
  {
    n: "01",
    title: "Choose a piece",
    text: "Pick anything marked “Try-on” from the catalogue, a collection, or the AI stylist's recommendations.",
  },
  {
    n: "02",
    title: "Add yourself",
    text: "Upload a clear photo or allow camera access. Detection runs in seconds and highlights where each piece will sit.",
  },
  {
    n: "03",
    title: "Wear, adjust, decide",
    text: "Fine-tune position and size, switch variants, save or share the look, then reserve it or book a showroom visit.",
  },
];

export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !root.current) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".hiw-line",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top 70%",
              end: "bottom 60%",
              scrub: 0.6,
            },
          },
        );
        gsap.utils.toArray<HTMLElement>(".hiw-step").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0.25, x: -12 },
            {
              opacity: 1,
              x: 0,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: {
                trigger: el,
                start: "top 75%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });
      }, root);
      cleanup = () => ctx.revert();
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reduced]);

  return (
    <Section id="how-it-works">
      <Container>
        <SectionHeading eyebrow="How It Works" title="Three steps from curious to certain" />
        <div ref={root} className="relative mx-auto max-w-3xl">
          <div
            aria-hidden
            className="hiw-line from-gold via-gold absolute top-4 bottom-4 left-[1.35rem] w-px origin-top bg-gradient-to-b to-transparent md:left-1/2"
          />
          <ol className="flex flex-col gap-12">
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                className={`hiw-step relative flex gap-6 md:w-1/2 ${i % 2 === 1 ? "md:ml-auto md:pl-10" : "md:pr-10"}`}
              >
                <span
                  className={`border-gold bg-bg font-display text-accent-text relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border text-lg md:absolute md:-translate-x-1/2 ${i % 2 === 1 ? "md:left-0" : "md:left-full"}`}
                >
                  {s.n}
                </span>
                <div className="md:px-4">
                  <h3 className="text-2xl">{s.title}</h3>
                  <p className="text-fg-muted mt-2">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-14 flex justify-center">
          <ButtonLink href="/try-on" variant="outline" size="lg">
            Try it now
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
