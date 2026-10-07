"use client";

import { useProgress } from "@react-three/drei";
import { Box, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CameraPreset, SceneHandle } from "./jewellery-scene";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import type { MetalType, ProductDetail, StoneType } from "@/lib/api/types";
import { METAL_LABELS, STONE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  metalOptions,
  pickModelForVariant,
  stoneOptions,
  swatchFor,
} from "@/lib/viewer3d/materials";
import { isLowEndDevice, supportsFullscreen, supportsWebGL } from "@/lib/viewer3d/support";

const JewelleryScene = dynamic(() => import("./jewellery-scene"), {
  ssr: false,
  loading: () => null,
});

export interface JewelleryViewerProps {
  product: Pick<
    ProductDetail,
    "id" | "name" | "variants" | "model_3d_assets" | "metal_type" | "stone_type"
  >;
  variantId: string | null;
  onVariantChange?: (variantId: string) => void;
  /** Called when the model cannot be shown (load failure, no WebGL); the host may fall back to photos. */
  onUnavailable?: (reason: "webgl" | "load") => void;
  className?: string;
  /** Hide the metal/stone switches (e.g. when the host page already has a selector nearby). */
  compact?: boolean;
  autoRotate?: boolean;
}

function LoadingOverlay({ active }: { active: boolean }) {
  const { progress } = useProgress();
  if (!active) return null;
  const pct = Math.round(progress);
  return (
    <div
      className="bg-bg/70 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <span
        className="border-gold-deep size-8 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
        aria-hidden
      />
      <p className="text-fg-muted text-xs tracking-[0.14em] uppercase">
        Loading 3D model {pct > 0 && pct < 100 ? `${pct}%` : ""}
      </p>
    </div>
  );
}

function ChromeButton({
  label,
  onClick,
  children,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        "bg-bg-elevated/90 text-fg border-border hover:border-fg focus-visible:ring-gold inline-flex size-11 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-colors focus-visible:ring-2 focus-visible:outline-none",
        pressed && "border-gold-deep bg-gold/20",
      )}
    >
      {children}
    </button>
  );
}

export function JewelleryViewer({
  product,
  variantId,
  onVariantChange,
  onUnavailable,
  className,
  compact,
  autoRotate = true,
}: JewelleryViewerProps) {
  const reduced = useReducedMotion();
  const sceneRef = useRef<SceneHandle>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [overlayFullscreen, setOverlayFullscreen] = useState(false);
  const [preset, setPreset] = useState<CameraPreset>("front");
  const lowEnd = useMemo(() => (typeof navigator === "undefined" ? true : isLowEndDevice()), []);

  useEffect(() => {
    // Probe WebGL after paint so the photos/skeleton render first.
    const id = window.setTimeout(() => {
      const ok = supportsWebGL();
      setWebgl(ok);
      if (!ok) onUnavailable?.("webgl");
    }, 0);
    return () => window.clearTimeout(id);
  }, [onUnavailable]);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const model = pickModelForVariant(product.model_3d_assets, variantId);
  const metal: MetalType = variant?.metal_type ?? product.metal_type;
  const tint = model && model.variant_id === variantId ? null : (variant?.tint_hex ?? null);
  // Only override gem colour when the viewer is showing a model authored for another stone.
  const stone: StoneType | null =
    variant && model && model.variant_id !== variant.id && variant.stone_type !== "none"
      ? variant.stone_type
      : null;

  const metals = metalOptions(product.variants, variantId);
  const stones = stoneOptions(product.variants, variantId);

  const handleError = useCallback(
    (e: Error) => {
      setError(
        e.message === "webgl-context-lost"
          ? "The 3D view was interrupted by your device. Please reopen it."
          : "This 3D model couldn't be loaded right now.",
      );
      onUnavailable?.("load");
    },
    [onUnavailable],
  );
  const handleLoaded = useCallback(() => setLoaded(true), []);
  const handleInteract = useCallback(() => setInteracted(true), []);

  // Fullscreen: native API where available, fixed overlay elsewhere (iOS Safari).
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!overlayFullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOverlayFullscreen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [overlayFullscreen]);

  const toggleFullscreen = async () => {
    const el = frameRef.current;
    if (!el) return;
    if (supportsFullscreen()) {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await el.requestFullscreen();
        return;
      } catch {
        /* fall through to the overlay */
      }
    }
    setOverlayFullscreen((v) => !v);
  };
  const isFull = fullscreen || overlayFullscreen;

  const choosePreset = (p: CameraPreset) => {
    setPreset(p);
    setInteracted(true);
    sceneRef.current?.setPreset(p);
  };

  if (!model) {
    return (
      <ErrorState
        compact
        title="No 3D model yet"
        description="This piece doesn't have a 3D model. Browse the photos instead."
        className={className}
      />
    );
  }
  if (webgl === false) {
    return (
      <ErrorState
        compact
        title="3D isn't supported on this browser"
        description="Your browser or device can't render 3D here. Try a recent Chrome, Safari or Firefox, or enjoy the product photos."
        className={className}
      />
    );
  }

  return (
    <div
      ref={frameRef}
      className={cn(
        "bg-bg-muted relative overflow-hidden rounded-lg",
        overlayFullscreen && "fixed inset-0 z-50 rounded-none",
        fullscreen && "bg-bg",
        className,
      )}
      data-testid="jewellery-viewer"
    >
      <div className={cn("relative", isFull ? "h-full min-h-dvh" : "aspect-square")}>
        {webgl && !error && (
          <JewelleryScene
            url={model.url}
            metal={metal}
            tintHex={tint}
            stone={stone}
            autoRotate={autoRotate && !reduced && !interacted && !lowEnd}
            sparkles={!reduced && !lowEnd}
            onInteract={handleInteract}
            onError={handleError}
            onLoaded={handleLoaded}
            sceneRef={sceneRef}
          />
        )}
        <LoadingOverlay active={!!webgl && !loaded && !error} />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <ErrorState
              compact
              title="3D view unavailable"
              description={error}
              onRetry={() => {
                setError(null);
                setLoaded(false);
              }}
            />
          </div>
        )}
        <p className="text-fg-muted pointer-events-none absolute bottom-3 left-3 text-[11px] tracking-[0.14em] uppercase">
          Drag to rotate · Scroll or pinch to zoom
        </p>
        <div
          className="absolute top-3 right-3 flex flex-col gap-2"
          role="toolbar"
          aria-label="3D viewer controls"
          aria-orientation="vertical"
        >
          <ChromeButton
            label="Zoom in"
            onClick={() => {
              setInteracted(true);
              sceneRef.current?.zoom(0.8);
            }}
          >
            <ZoomIn className="size-5" aria-hidden />
          </ChromeButton>
          <ChromeButton
            label="Zoom out"
            onClick={() => {
              setInteracted(true);
              sceneRef.current?.zoom(1.25);
            }}
          >
            <ZoomOut className="size-5" aria-hidden />
          </ChromeButton>
          <ChromeButton
            label="Reset view"
            onClick={() => {
              setInteracted(false);
              setPreset("front");
              sceneRef.current?.reset();
            }}
          >
            <RotateCcw className="size-5" aria-hidden />
          </ChromeButton>
          <ChromeButton
            label={isFull ? "Exit fullscreen" : "Fullscreen"}
            onClick={() => void toggleFullscreen()}
            pressed={isFull}
          >
            {isFull ? (
              <Minimize2 className="size-5" aria-hidden />
            ) : (
              <Maximize2 className="size-5" aria-hidden />
            )}
          </ChromeButton>
        </div>
        <div
          className="bg-bg-elevated/90 absolute top-3 left-3 flex gap-1 rounded-full p-1 shadow-sm backdrop-blur"
          role="group"
          aria-label="Camera angle"
        >
          {(["front", "top", "side"] as CameraPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => choosePreset(p)}
              aria-pressed={preset === p}
              className={cn(
                "min-h-9 rounded-full px-3 text-xs font-medium capitalize transition-colors",
                preset === p ? "bg-gold/25 text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {!compact && (metals.length > 1 || stones.length > 1) && (
        <div
          className={cn(
            "flex flex-col gap-3 p-3",
            isFull && "bg-bg-elevated/90 absolute right-0 bottom-0 left-0 backdrop-blur",
          )}
        >
          {metals.length > 1 && (
            <div
              role="group"
              aria-label="Metal colour"
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-fg-muted mr-1 text-xs tracking-[0.14em] uppercase">Metal</span>
              {metals.map((opt) => {
                const selected = opt.value === metal;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onVariantChange?.(opt.variantId)}
                    aria-pressed={selected}
                    aria-label={METAL_LABELS[opt.value]}
                    title={METAL_LABELS[opt.value]}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
                      selected ? "border-gold-deep bg-gold/15" : "border-border hover:border-fg",
                    )}
                  >
                    <span
                      aria-hidden
                      className="border-ink/20 size-4 rounded-full border"
                      style={{ background: swatchFor(opt.value, product.variants) }}
                    />
                    {METAL_LABELS[opt.value]}
                  </button>
                );
              })}
            </div>
          )}
          {stones.length > 1 && (
            <div role="group" aria-label="Stone" className="flex flex-wrap items-center gap-2">
              <span className="text-fg-muted mr-1 text-xs tracking-[0.14em] uppercase">Stone</span>
              {stones.map((opt) => {
                const selected = (variant?.stone_type ?? product.stone_type) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onVariantChange?.(opt.variantId)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-3 text-sm transition-colors",
                      selected ? "border-gold-deep bg-gold/15" : "border-border hover:border-fg",
                    )}
                  >
                    {STONE_LABELS[opt.value]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "View in 3D" control that preloads the model on intent before the viewer mounts. */
export function View3DButton({
  url,
  onClick,
  active,
  className,
}: {
  url: string | null;
  onClick: () => void;
  active: boolean;
  className?: string;
}) {
  const preload = () => {
    if (url) void import("./jewellery-scene").then((m) => m.preloadModel(url));
  };
  return (
    <Button
      type="button"
      variant={active ? "primary" : "outline"}
      size="md"
      onMouseEnter={preload}
      onFocus={preload}
      onTouchStart={preload}
      onClick={onClick}
      aria-pressed={active}
      leftIcon={<Box className="size-4" aria-hidden />}
      className={className}
    >
      {active ? "3D view" : "View in 3D"}
    </Button>
  );
}
