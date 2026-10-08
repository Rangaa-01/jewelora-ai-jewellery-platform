"use client";

import { Camera, ChevronDown, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MagneticButton, Reveal, Sparkle } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { useProducts } from "@/lib/api/hooks";

/**
 * A real piece from the catalogue (the first featured necklace with a photo, else any
 * featured piece), shown as studio photography. No drawn or computer-generated jewellery.
 */
function HeroPiece() {
  const query = useProducts({ featured: true, page_size: 24 });
  const items = (query.data?.items ?? []).filter((p) => p.primary_image);
  const piece =
    items.find((p) => p.jewellery_type === "necklace") ??
    items.find((p) => p.jewellery_type !== "set") ??
    items[0];
  if (!piece?.primary_image) {
    return (
      <div className="bg-bg-muted size-full animate-pulse rounded-lg motion-reduce:animate-none" />
    );
  }
  return (
    <Link
      href={`/products/${piece.slug}`}
      className="group relative block size-full overflow-hidden rounded-lg shadow-lg"
      aria-label={`${piece.name}, view the piece`}
    >
      <Image
        src={piece.primary_image.url}
        alt={piece.primary_image.alt_text || piece.name}
        fill
        preload
        sizes="(max-width: 1024px) 90vw, 40vw"
        className="object-cover transition-transform duration-700 ease-[var(--ease-luxe)] group-hover:scale-[1.03] motion-reduce:transition-none"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16">
        <p className="text-ivory/80 text-[0.7rem] tracking-[0.18em] uppercase">Featured piece</p>
        <p className="font-display text-ivory text-2xl">{piece.name}</p>
      </div>
    </Link>
  );
}

export function Hero() {
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

        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm lg:max-w-md">
          <HeroPiece />
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
