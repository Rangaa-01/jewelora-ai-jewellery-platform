"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { ImagePlus, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { LookItemList } from "./look-item-list";
import { ProductPicker } from "./product-picker";
import { ResultPanel } from "./result-panel";
import { FormError } from "@/components/forms/form-error";
import { ImageDropzone } from "@/components/forms/image-dropzone";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, isApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/hooks";
import type { JewelleryType, ProductDetail, ProductSummary } from "@/lib/api/types";
import type { Adjustments } from "@/lib/tryon/fitting/types";
import {
  makeLookItem,
  pickVariantId,
  type LookItem,
  type TryOnCapabilities,
  type TryOnMode,
} from "@/lib/tryon/session";
import { useTryOnSession } from "@/lib/tryon/use-tryon-session";

const LiveTryOn = dynamic(() => import("./live-tryon").then((m) => m.LiveTryOn), {
  ssr: false,
  loading: () => (
    <div className="bg-ink aspect-[3/4] max-h-[70vh] w-full animate-pulse rounded-lg" />
  ),
});

interface TryOnStudioProps {
  initialSlugs: string[];
  initialVariantId?: string;
  mode: TryOnMode;
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
  const [items, setItems] = useState<LookItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState("photo");
  const { toast } = useToast();
  const session = useTryOnSession(mode);

  const capabilities = useQuery({
    queryKey: ["tryon", "capabilities"],
    queryFn: () => api.get<TryOnCapabilities>("/tryon/capabilities"),
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Product details (variants + try-on assets) for every piece in the look.
  const slugs = useMemo(
    () => Array.from(new Set([...initialSlugs, ...items.map((i) => i.product.slug)])),
    [initialSlugs, items],
  );
  const detailQueries = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: queryKeys.product(slug),
      queryFn: () => api.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`),
      retry: false,
      staleTime: 60_000,
    })),
  });
  const details = useMemo(() => {
    const map: Record<string, ProductDetail | undefined> = {};
    detailQueries.forEach((q, i) => {
      map[slugs[i]!] = q.data;
    });
    return map;
  }, [detailQueries, slugs]);

  // Seed the look from URL products once they load (render-phase derived state).
  const [seeded, setSeeded] = useState(initialSlugs.length === 0);
  if (!seeded && initialSlugs.every((s) => detailQueries[slugs.indexOf(s)]?.isPending === false)) {
    setSeeded(true);
    const loaded = initialSlugs.map((s) => details[s]).filter((p): p is ProductDetail => !!p);
    if (loaded.length) {
      setItems(
        loaded.map((p, i) =>
          makeLookItem(p, pickVariantId(p, i === 0 ? (initialVariantId ?? null) : null)),
        ),
      );
    }
  }

  const toggle = useCallback(
    (p: ProductSummary) =>
      setItems((cur) => {
        if (cur.some((c) => c.product.id === p.id)) return cur.filter((c) => c.product.id !== p.id);
        // One piece per slot type keeps the look coherent.
        return [
          ...cur.filter((c) => c.product.jewellery_type !== p.jewellery_type),
          makeLookItem(p),
        ];
      }),
    [],
  );
  const update = useCallback(
    (productId: string, patch: Partial<LookItem>) =>
      setItems((cur) => cur.map((i) => (i.product.id === productId ? { ...i, ...patch } : i))),
    [],
  );
  // Default the variant once details arrive.
  const resolvedItems = useMemo(
    () =>
      items.map((i) => ({ ...i, variantId: pickVariantId(details[i.product.slug], i.variantId) })),
    [items, details],
  );

  const onAdjust = (productId: string, adjustments: Adjustments) => {
    update(productId, { adjustments });
    if (session.result) {
      const next = Object.fromEntries(
        resolvedItems.map(
          (i) => [i.product.id, i.product.id === productId ? adjustments : i.adjustments] as const,
        ),
      );
      session.scheduleAdjust(session.result.id, next);
    }
  };

  const runNow = (candidate: File | null = file) => {
    if (!candidate || resolvedItems.length === 0) return;
    session.run.mutate(
      { file: candidate, items: resolvedItems },
      {
        onSuccess: (r) => {
          if (r.warnings.length)
            toast({ title: "Heads up", description: r.warnings[0], tone: "info" });
        },
      },
    );
  };
  const onCapture = (captured: File) => {
    setFile(captured);
    runNow(captured);
  };

  const tryAnother = () => {
    if (!session.result) return;
    session.rerun.mutate({ photoId: session.result.photo_id, items: resolvedItems });
  };

  const unavailable = capabilities.data ? !capabilities.data.photo_tryon : false;
  const error = session.run.error ?? session.rerun.error ?? session.adjust.error;
  const canRun = !!file && resolvedItems.length > 0 && !unavailable;
  const slots = mode === "bridal" ? BRIDAL_SLOTS : LOOK_TYPES;

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
                ? "Build the complete ensemble — tikka to anklets — on one photo or live, then save and share it with family."
                : "Choose pieces, then use your camera live or upload a photo and we'll fit each piece to you."}
            </p>
          </div>
          <p className="text-fg-muted text-xs">
            Photos are private, encrypted and deleted after 30 days.
          </p>
        </div>

        {unavailable && (
          <p role="status" className="border-gold/40 bg-gold/5 mb-6 rounded-md border p-3 text-sm">
            Photo try-on is temporarily unavailable while the vision models are being set up. Live
            try-on still works on your device, and you can book a visit to try pieces in store.
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
          <aside className="flex flex-col gap-6">
            <section aria-labelledby="look-items">
              <h2 id="look-items" className="mb-3 text-xl">
                Your look{" "}
                {items.length > 0 && (
                  <span className="text-fg-muted text-sm">({items.length})</span>
                )}
              </h2>
              <LookItemList
                items={resolvedItems}
                details={details}
                detection={session.result?.detection}
                onRemove={(id) => setItems((cur) => cur.filter((i) => i.product.id !== id))}
                onVariantChange={(id, variantId) => update(id, { variantId })}
                onSlotChange={(id, slot) => update(id, { slot })}
              />
            </section>
            <section aria-labelledby="pick-items">
              <h2 id="pick-items" className="mb-3 text-xl">
                {mode === "bridal" ? "Bridal pieces" : "Add pieces"}
              </h2>
              <ProductPicker
                selected={items.map((i) => i.product)}
                onToggle={toggle}
                types={slots}
              />
            </section>
          </aside>

          <div className="flex flex-col gap-6">
            {session.result ? (
              <ResultPanel
                result={session.result}
                originalUrl={session.originalUrl}
                items={resolvedItems}
                busy={session.adjust.isPending || session.rerun.isPending}
                onAdjust={onAdjust}
                onChangePhoto={() => {
                  session.reset();
                  setFile(null);
                }}
                onTryAnother={tryAnother}
              />
            ) : (
              <Tabs defaultValue="photo" value={tab} onValueChange={setTab}>
                <TabList label="Try-on mode">
                  <Tab value="photo">Upload photo</Tab>
                  <Tab value="live">Live camera</Tab>
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
                <TabPanel value="live">
                  {tab === "live" && (
                    <LiveTryOn
                      items={resolvedItems}
                      details={details}
                      onAdjust={onAdjust}
                      onCapture={onCapture}
                    />
                  )}
                </TabPanel>
              </Tabs>
            )}
            {(error || (session.run.isPending && tab === "live")) && (
              <div className="border-border bg-bg-elevated rounded-lg border p-4">
                {isApiError(error) && error.code === "tryon_unavailable" ? (
                  <p role="alert" className="text-sm">
                    Photo try-on is temporarily unavailable. Please try again shortly or book a
                    store visit.
                  </p>
                ) : (
                  <FormError error={error} />
                )}
                {session.run.isPending && (
                  <p className="text-fg-muted text-sm">Rendering your look…</p>
                )}
              </div>
            )}
            {!session.result && tab === "photo" && (
              <div className="border-border bg-bg-elevated flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => runNow()}
                    disabled={!canRun}
                    loading={session.run.isPending}
                    leftIcon={<Sparkles className="size-5" aria-hidden />}
                  >
                    {mode === "bridal"
                      ? "Create My Bridal Look"
                      : resolvedItems.length > 1
                        ? "Try Complete Look"
                        : "Try It On"}
                  </Button>
                  {!canRun && !unavailable && (
                    <p className="text-fg-muted text-sm">
                      {resolvedItems.length === 0
                        ? "Add at least one piece"
                        : "Add a photo to continue"}
                    </p>
                  )}
                </div>
              </div>
            )}
            {!file && !session.result && (
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
