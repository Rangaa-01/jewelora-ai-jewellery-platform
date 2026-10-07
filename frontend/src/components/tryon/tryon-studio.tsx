"use client";

import { useMutation, useQueries } from "@tanstack/react-query";
import { Download, Heart, ImagePlus, Save, Share2, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { CameraCapture } from "./camera-capture";
import { ProductPicker } from "./product-picker";
import { FormError } from "@/components/forms/form-error";
import { ImageDropzone } from "@/components/forms/image-dropzone";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";
import type { JewelleryType, ProductDetail, ProductSummary } from "@/lib/api/types";
import { JEWELLERY_TYPE_LABELS } from "@/lib/labels";
import { useShopperStore } from "@/lib/stores/shopper-store";

export interface TryOnResult {
  id: string;
  result_url: string;
  width: number;
  height: number;
  confidence: number | null;
  warnings: string[];
  placements?: Record<string, unknown>;
}

interface TryOnStudioProps {
  initialSlugs: string[];
  initialVariantId?: string;
  mode: "look" | "bridal";
}

const BRIDAL_SLOTS: JewelleryType[] = [
  "maang_tikka",
  "earrings",
  "nose_ring",
  "necklace",
  "haram",
  "bangle",
  "ring",
  "waist_chain",
  "anklet",
];
const LOOK_TYPES: JewelleryType[] = [
  "necklace",
  "chain",
  "pendant",
  "haram",
  "choker",
  "earrings",
  "ring",
  "bangle",
  "bracelet",
  "nose_ring",
  "maang_tikka",
  "waist_chain",
  "anklet",
];

export function TryOnStudio({ initialSlugs, initialVariantId, mode }: TryOnStudioProps) {
  const [selected, setSelected] = useState<ProductSummary[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const { toast } = useToast();
  const toggleWishlist = useShopperStore((s) => s.toggleWishlist);

  const initial = useQueries({
    queries: initialSlugs.map((slug) => ({
      queryKey: ["product", slug],
      queryFn: () => api.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`),
      retry: false,
    })),
  });
  // Seed the look from URL products once they load (render-phase derived state).
  const [seeded, setSeeded] = useState(initialSlugs.length === 0);
  const loadedInitial = initial.map((q) => q.data).filter((p): p is ProductDetail => !!p);
  if (!seeded && initial.every((q) => !q.isPending)) {
    setSeeded(true);
    if (loadedInitial.length) setSelected(loadedInitial);
  }

  const toggle = (p: ProductSummary) =>
    setSelected((cur) => {
      if (cur.some((c) => c.id === p.id)) return cur.filter((c) => c.id !== p.id);
      // One piece per slot type keeps the look coherent.
      return [...cur.filter((c) => c.jewellery_type !== p.jewellery_type), p];
    });

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("no file");
      const form = new FormData();
      form.append("photo", file);
      form.append("mode", mode);
      form.append(
        "items",
        JSON.stringify(
          selected.map((p) => ({
            product_id: p.id,
            variant_id: p.id === selected[0]?.id ? (initialVariantId ?? null) : null,
          })),
        ),
      );
      return api.upload<TryOnResult>("/tryon/photo", form);
    },
    onSuccess: (r) => {
      setResult(r);
      if (r.warnings.length) toast({ title: "Heads up", description: r.warnings[0], tone: "info" });
    },
  });

  const canRun = !!file && selected.length > 0;
  const slots = useMemo(() => (mode === "bridal" ? BRIDAL_SLOTS : LOOK_TYPES), [mode]);

  return (
    <Section padding="sm" className="pt-8 md:pt-12">
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2 inline-flex items-center gap-2">
              <Sparkles className="size-4" aria-hidden />{" "}
              {mode === "bridal" ? "Bridal mode" : "Try-on studio"}
            </p>
            <h1 className="text-4xl md:text-5xl">
              {mode === "bridal" ? "Create my bridal look" : "See it on you"}
            </h1>
            <p className="text-fg-muted mt-2 max-w-xl">
              {mode === "bridal"
                ? "Build the complete ensemble — tikka to anklets — on one photo, then save and share it with family."
                : "Choose pieces, add a photo or capture one, and we'll fit each piece to you."}
            </p>
          </div>
          <p className="text-fg-muted text-xs">
            Photos are private, encrypted and deleted after 30 days.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
          <aside className="flex flex-col gap-6">
            <section aria-labelledby="look-items">
              <h2 id="look-items" className="mb-3 text-xl">
                Your look{" "}
                {selected.length > 0 && (
                  <span className="text-fg-muted text-sm">({selected.length})</span>
                )}
              </h2>
              {selected.length === 0 ? (
                <p className="border-border-strong text-fg-muted rounded-sm border border-dashed p-3 text-sm">
                  No pieces yet. Pick from the catalogue below.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {selected.map((p) => (
                    <li
                      key={p.id}
                      className="border-border bg-bg-elevated flex items-center gap-3 rounded-md border p-2"
                    >
                      <div className="bg-bg-muted relative size-12 shrink-0 overflow-hidden rounded-sm">
                        {p.primary_image && (
                          <Image
                            src={p.primary_image.url}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-fg-muted text-xs">
                          {JEWELLERY_TYPE_LABELS[p.jewellery_type]}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(p)}
                        className="touch-target text-fg-muted hover:text-fg inline-flex items-center justify-center"
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="pick-items">
              <h2 id="pick-items" className="mb-3 text-xl">
                {mode === "bridal" ? "Bridal pieces" : "Add pieces"}
              </h2>
              <ProductPicker selected={selected} onToggle={toggle} types={slots} />
            </section>
          </aside>

          <div className="flex flex-col gap-6">
            {result ? (
              <div className="flex flex-col gap-4">
                <div
                  className="bg-bg-muted relative overflow-hidden rounded-lg"
                  style={{ aspectRatio: `${result.width} / ${result.height}` }}
                >
                  <Image
                    src={result.result_url}
                    alt="Your try-on result"
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                {result.confidence !== null && result.confidence < 0.6 && (
                  <p className="text-fg-muted text-sm">
                    Detection confidence was low for this photo. A front-facing photo in even light
                    gives a more accurate fit.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    leftIcon={<Save className="size-4" aria-hidden />}
                    onClick={() =>
                      toast({
                        title: "Sign in to save looks",
                        description: "Saved looks sync to your account.",
                        tone: "info",
                      })
                    }
                  >
                    Save Look
                  </Button>
                  <Button
                    variant="outline"
                    leftIcon={<Share2 className="size-4" aria-hidden />}
                    onClick={async () => {
                      try {
                        if (navigator.share)
                          await navigator.share({
                            title: "My Jewelora look",
                            url: result.result_url,
                          });
                        else {
                          await navigator.clipboard.writeText(result.result_url);
                          toast({ title: "Link copied", tone: "success" });
                        }
                      } catch {
                        /* user cancelled */
                      }
                    }}
                  >
                    Share Look
                  </Button>
                  <a
                    href={result.result_url}
                    download
                    className="border-border-strong hover:border-fg inline-flex h-11 items-center gap-2 rounded-sm border px-6 text-sm font-medium"
                  >
                    <Download className="size-4" aria-hidden /> Download
                  </a>
                  <Button
                    variant="ghost"
                    leftIcon={<Heart className="size-4" aria-hidden />}
                    onClick={() => {
                      selected.forEach((p) => {
                        if (!useShopperStore.getState().isWishlisted(p.id))
                          toggleWishlist({
                            productId: p.id,
                            slug: p.slug,
                            name: p.name,
                            price: p.price,
                            imageUrl: p.primary_image?.url ?? null,
                          });
                      });
                      toast({ title: "Added all to wishlist", tone: "success" });
                    }}
                  >
                    Add All to Wishlist
                  </Button>
                  <ButtonLink
                    href={`/appointments/new?products=${selected.map((p) => p.slug).join(",")}`}
                    variant="ghost"
                  >
                    Book Appointment
                  </ButtonLink>
                  <Button variant="ghost" onClick={() => setResult(null)}>
                    Change photo
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="photo">
                <TabList label="Try-on mode">
                  <Tab value="photo">Upload photo</Tab>
                  <Tab value="camera">Use camera</Tab>
                </TabList>
                <TabPanel value="photo">
                  <ImageDropzone
                    file={file}
                    onChange={setFile}
                    label="Upload your photo"
                    hint={
                      mode === "bridal"
                        ? "A front-facing photo from the waist up, with hair away from the ears, works best."
                        : "Face, neck and shoulders visible for necklaces and earrings; hand flat for rings and bangles."
                    }
                  />
                </TabPanel>
                <TabPanel value="camera">
                  {file ? (
                    <ImageDropzone file={file} onChange={setFile} />
                  ) : (
                    <CameraCapture onCapture={setFile} />
                  )}
                </TabPanel>
              </Tabs>
            )}
            {!result && (
              <div className="border-border bg-bg-elevated flex flex-col gap-3 rounded-lg border p-4">
                <FormError error={run.error} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => run.mutate()}
                    disabled={!canRun}
                    loading={run.isPending}
                    leftIcon={<Sparkles className="size-5" aria-hidden />}
                  >
                    {mode === "bridal"
                      ? "Create My Bridal Look"
                      : selected.length > 1
                        ? "Try Complete Look"
                        : "Try It On"}
                  </Button>
                  {!canRun && (
                    <p className="text-fg-muted text-sm">
                      {selected.length === 0 ? "Add at least one piece" : "Add a photo to continue"}
                    </p>
                  )}
                </div>
              </div>
            )}
            {!file && !result && (
              <div className="border-border text-fg-muted flex items-start gap-3 rounded-lg border p-4 text-sm">
                <ImagePlus className="text-accent-text mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  Tips: good, even lighting; no sunglasses; hair tucked behind ears for earrings;
                  hand flat and fully in frame for rings and bangles.
                </p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
