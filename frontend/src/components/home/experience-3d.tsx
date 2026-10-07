"use client";

import { Box, Palette, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { JewelleryViewer } from "@/components/viewer3d";
import { useProduct, useProducts } from "@/lib/api/hooks";

/** Mounts the live viewer only once the section scrolls into view (nothing 3D loads before). */
function LiveViewer() {
  const featured = useProducts({ featured: true, page_size: 12 });
  const first3d = featured.data?.items.find((p) => p.has_3d) ?? null;
  const detail = useProduct(first3d?.slug ?? "");
  const [variantId, setVariantId] = useState<string | null>(null);
  const product = first3d ? detail.data : null;
  const activeVariant =
    variantId ??
    product?.variants.find((v) => v.is_default && v.is_active)?.id ??
    product?.variants.find((v) => v.is_active)?.id ??
    null;

  if (featured.isPending || (first3d && detail.isPending)) {
    return <Skeleton className="aspect-square w-full rounded-lg" />;
  }
  if (!product) {
    return (
      <EmptyState
        compact
        icon={Box}
        title="3D pieces are being prepared"
        description="As soon as the shop publishes a 3D model you'll be able to turn it right here."
        className="aspect-square"
      />
    );
  }
  return (
    <div>
      <JewelleryViewer product={product} variantId={activeVariant} onVariantChange={setVariantId} />
      <p className="text-ivory/70 mt-3 text-sm">
        Showing <span className="text-ivory">{product.name}</span>.{" "}
        <ButtonLink href={`/products/${product.slug}`} variant="link" className="!text-gold-bright">
          View this piece
        </ButtonLink>
      </p>
    </div>
  );
}

export function Experience3D() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

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
              { icon: Palette, text: "Only the metals and stones the piece is made in" },
              { icon: Sparkles, text: "Physically based metal and stone shading" },
              { icon: Box, text: "Models load only when you open them" },
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
        <div ref={ref} className="relative mx-auto w-full max-w-md lg:max-w-none">
          {visible ? <LiveViewer /> : <Skeleton className="aspect-square w-full rounded-lg" />}
        </div>
      </Container>
    </Section>
  );
}
