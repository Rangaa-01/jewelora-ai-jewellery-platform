import { Box, Palette, RotateCcw, Sparkles } from "lucide-react";
import { Parallax, Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";

export function Experience3D() {
  return (
    <Section tone="inverse" className="overflow-hidden">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow !text-gold-bright mb-3">3D Jewellery Experience</p>
          <h2 className="text-ivory text-4xl md:text-5xl">Turn it. Zoom in. See every facet.</h2>
          <p className="text-ivory/75 mt-5 max-w-lg text-pretty">
            Pieces with a 3D model open in an interactive viewer with realistic gold reflections and
            diamond sparkle. Rotate 360°, switch metal colours and go fullscreen on any device.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { icon: RotateCcw, text: "360° rotation, pinch zoom and pan" },
              { icon: Palette, text: "Yellow, white and rose gold, platinum" },
              { icon: Sparkles, text: "Physically based metal and stone shading" },
              { icon: Box, text: "Optimised models that load only when opened" },
            ].map((f) => (
              <li key={f.text} className="text-ivory/85 flex items-start gap-3 text-sm">
                <f.icon className="text-gold-bright mt-0.5 size-4 shrink-0" aria-hidden />
                {f.text}
              </li>
            ))}
          </ul>
          <ButtonLink href="/products" className="mt-9" size="lg">
            Browse pieces in 3D
          </ButtonLink>
        </Reveal>
        <Parallax offset={40} className="relative mx-auto aspect-square w-full max-w-md">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(228,199,127,0.25),transparent_60%)]"
          />
          <svg viewBox="0 0 400 400" className="relative size-full" aria-hidden>
            <defs>
              <linearGradient id="ring3d" x1="0" x2="1">
                <stop offset="0" stopColor="#8a6a2b" />
                <stop offset="0.5" stopColor="#f1dca0" />
                <stop offset="1" stopColor="#8a6a2b" />
              </linearGradient>
            </defs>
            <g className="origin-center animate-[spin_24s_linear_infinite] motion-reduce:animate-none">
              <ellipse
                cx="200"
                cy="200"
                rx="150"
                ry="60"
                fill="none"
                stroke="url(#ring3d)"
                strokeWidth="18"
              />
              <ellipse
                cx="200"
                cy="200"
                rx="60"
                ry="150"
                fill="none"
                stroke="url(#ring3d)"
                strokeWidth="10"
                opacity=".7"
              />
            </g>
            <polygon points="200,150 235,185 200,250 165,185" fill="#fff" opacity=".92" />
            <path
              d="M165 185h70M200 150l-15 35 15 65 15-65-15-35"
              stroke="#c6a15b"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </Parallax>
      </Container>
    </Section>
  );
}
