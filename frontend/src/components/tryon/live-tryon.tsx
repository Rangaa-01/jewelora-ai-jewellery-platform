"use client";

import { Camera, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { AdjustmentControls } from "./adjustment-controls";
import { LiveStateOverlay } from "./live-states";
import { Button } from "@/components/ui/button";
import type { ProductDetail } from "@/lib/api/types";
import { JEWELLERY_TYPE_LABELS } from "@/lib/labels";
import type { Adjustments } from "@/lib/tryon/fitting/types";
import type { LiveQuality } from "@/lib/tryon/live/types";
import { useLiveTryOn } from "@/lib/tryon/live/use-live-tryon";
import type { LookItem } from "@/lib/tryon/session";

interface LiveTryOnProps {
  items: LookItem[];
  details: Record<string, ProductDetail | undefined>;
  onAdjust: (productId: string, adjustments: Adjustments) => void;
  onCapture: (file: File) => void;
}

function hintFor(missing: string[], hasItems: boolean): string | null {
  if (!hasItems) return "Add a piece to see it on you.";
  if (missing.length === 0) return null;
  const needsHand = missing.some((t) => t === "ring" || t === "bangle" || t === "bracelet");
  const needsFace = missing.some(
    (t) => !["ring", "bangle", "bracelet", "waist_chain", "anklet"].includes(t),
  );
  if (needsHand && needsFace) return "Show your face and the back of your hand in the frame.";
  if (needsHand) return "Show the back of your hand with fingers spread.";
  if (needsFace) return "Face the camera with your neck and ears visible.";
  return "Step back so your waist or ankles are in the frame.";
}

/** Real-time camera try-on with on-device detection and a canvas jewellery overlay. */
export function LiveTryOn({ items, details, onAdjust, onCapture }: LiveTryOnProps) {
  const [quality, setQuality] = useState<LiveQuality>("auto");
  const [showAdjust, setShowAdjust] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const qualityId = useId();
  const {
    attachVideo,
    attachCanvas,
    status,
    progress,
    facing,
    missing,
    stats,
    assetProblem,
    start,
    stop,
    switchCamera,
    capture: captureLive,
    updateAdjustments,
  } = useLiveTryOn({ items, details, quality });
  const running = status === "running";
  const hint = running ? hintFor(missing, items.length > 0) : null;
  const values = Object.fromEntries(items.map((i) => [i.product.id, i.adjustments] as const));

  const capture = async () => {
    setCapturing(true);
    try {
      const file = await captureLive();
      if (file) onCapture(file);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-ink relative aspect-[3/4] max-h-[70vh] w-full overflow-hidden rounded-lg">
        <video
          ref={attachVideo}
          playsInline
          muted
          className={`size-full object-cover ${facing === "user" ? "-scale-x-100" : ""} ${running ? "" : "invisible"}`}
          aria-label="Live camera preview"
        />
        <canvas
          ref={attachCanvas}
          className={`pointer-events-none absolute inset-0 size-full object-cover ${running ? "" : "invisible"}`}
          aria-hidden
          data-testid="live-overlay"
        />
        <LiveStateOverlay status={status} progress={progress} onStart={() => void start()} />
        {hint && (
          <p
            role="status"
            className="bg-ink/70 text-ivory absolute top-3 right-3 left-3 rounded-md px-3 py-2 text-center text-sm"
          >
            {hint}
          </p>
        )}
        {running && (
          <p
            className="text-ivory/70 absolute bottom-2 left-3 text-[0.65rem] tabular-nums"
            aria-live="off"
          >
            {stats.fps} fps · {stats.inferenceMs} ms · {stats.delegate}
          </p>
        )}
      </div>

      {assetProblem && (
        <p role="status" className="border-gold/40 bg-gold/5 rounded-md border p-3 text-sm">
          {assetProblem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <>
            <Button
              size="lg"
              onClick={() => void capture()}
              loading={capturing}
              disabled={items.length === 0}
              leftIcon={<Camera className="size-5" aria-hidden />}
            >
              Capture
            </Button>
            <Button variant="outline" size="icon" aria-label="Switch camera" onClick={switchCamera}>
              <RefreshCw className="size-5" aria-hidden />
            </Button>
            <Button
              variant="outline"
              leftIcon={<SlidersHorizontal className="size-4" aria-hidden />}
              onClick={() => setShowAdjust((v) => !v)}
              aria-expanded={showAdjust}
              disabled={items.length === 0}
            >
              Fine-tune
            </Button>
            <Button variant="ghost" onClick={stop}>
              Stop
            </Button>
          </>
        ) : null}
        <label
          htmlFor={qualityId}
          className="text-fg-muted ml-auto inline-flex items-center gap-2 text-xs"
        >
          Quality
          <select
            id={qualityId}
            value={quality}
            onChange={(e) => setQuality(e.target.value as LiveQuality)}
            className="border-border-strong bg-bg-elevated h-11 rounded-sm border px-2 text-sm"
          >
            <option value="auto">Auto</option>
            <option value="low">Low (faster)</option>
            <option value="high">High (sharper)</option>
          </select>
        </label>
      </div>

      {running && showAdjust && (
        <AdjustmentControls
          items={items.map((i) => ({ id: i.product.id, label: i.product.name }))}
          values={values}
          onChange={(id, next) => {
            updateAdjustments(id, next);
            onAdjust(id, next);
          }}
          offsetRange={150}
        />
      )}

      <p className="text-fg-muted text-xs">
        The preview runs entirely on your device. Pressing Capture sends that single frame to render
        the final, shareable result with the server&apos;s higher-quality compositing.
        {running && items.length > 0 && (
          <>
            {" "}
            Tracking: {items.map((i) => JEWELLERY_TYPE_LABELS[i.product.jewellery_type]).join(", ")}
            .
          </>
        )}
      </p>
    </div>
  );
}
