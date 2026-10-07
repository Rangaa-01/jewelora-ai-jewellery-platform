"use client";

import { Camera, ChevronDown, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MagneticButton, Reveal, Sparkle, useReducedMotion } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false, loading: () => null });

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function StaticRing() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#8a6a2b" />
          <stop offset="0.5" stopColor="#e4c77f" />
          <stop offset="1" stopColor="#8a6a2b" />
        </linearGradient>
      </defs>
      <ellipse
        cx="200"
        cy="230"
        rx="120"
        ry="135"
        fill="none"
        stroke="url(#gold)"
        strokeWidth="26"
      />
      <polygon
        points="200,45 240,85 200,135 160,85"
        fill="#fff"
        stroke="#c6a15b"
        strokeWidth="3"
        opacity=".95"
      />
      <path
        d="M160 85h80M200 45 180 85l20 50 20-50-20-40"
        fill="none"
        stroke="#c6a15b"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(() => setWebgl(supportsWebGL()))
      : window.setTimeout(() => setWebgl(supportsWebGL()), 200);
    return () =>
      window.cancelIdleCallback
        ? window.cancelIdleCallback(id as number)
        : window.clearTimeout(id as number);
  }, []);

  return (
    <section
      className="relative -mt-[var(--header-h)] flex min-h-[100svh] items-center overflow-hidden bg-[radial-gradient(120%_80%_at_70%_20%,var(--color-ivory-soft),var(--bg)_60%)] pt-[var(--header-h)]"
      aria-labelledby="hero-title"
    >
      <Sparkle className="opacity-70" count={36} />
      <div className="container-x relative grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6 lg:py-0">
        <div className="relative z-10 max-w-2xl">
          <Reveal direction="none" duration={0.9}>
            <p className="eyebrow mb-5 inline-flex items-center gap-2">
              <Sparkles className="size-4" aria-hidden /> AI virtual try-on · 3D viewing · in-store
              expertise
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1
              id="hero-title"
              className="text-[2.75rem] leading-[1.02] text-balance sm:text-6xl lg:text-7xl"
            >
              Try jewellery <em className="gold-text not-italic">before</em> you buy
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="text-fg-muted mt-6 max-w-xl text-lg text-pretty md:text-xl">
              Upload a photo or open your camera and see necklaces, earrings, rings and complete
              bridal sets on you — then reserve a piece or visit the showroom.
            </p>
          </Reveal>
          <Reveal delay={0.34}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <MagneticButton>
                <ButtonLink
                  href="/try-on"
                  size="lg"
                  leftIcon={<Camera className="size-5" aria-hidden />}
                >
                  Try It On
                </ButtonLink>
              </MagneticButton>
              <ButtonLink href="/collections" size="lg" variant="outline">
                Explore Collection
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal delay={0.5} direction="none">
            <dl className="border-border mt-12 grid max-w-md grid-cols-3 gap-4 border-t pt-6 text-sm">
              {[
                ["Photo & live", "two try-on modes"],
                ["BIS", "hallmarked gold"],
                ["Private", "photos stay yours"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-display text-fg text-xl">{k}</dt>
                  <dd className="text-fg-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md lg:max-w-xl">
          <div
            aria-hidden
            className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(228,199,127,0.35),transparent_65%)] blur-2xl"
          />
          <div className="relative size-full">
            {webgl && !reduced ? <HeroScene reduced={reduced} /> : <StaticRing />}
          </div>
        </div>
      </div>
      <a
        href="#tryon-intro"
        className="text-fg-muted hover:text-fg absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs tracking-[0.2em] uppercase lg:flex"
        aria-label="Scroll to learn more"
      >
        Scroll
        <ChevronDown className="size-4 animate-bounce motion-reduce:animate-none" aria-hidden />
      </a>
    </section>
  );
}
