"use client";

import { RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { JewelleryType } from "@/lib/api/types";
import { ANCHOR_SPECS, anchorLabel, canvasToNormalised, fitImage, missingAnchors, nextAnchor, normalisedToCanvas, type AnchorMap } from "@/lib/admin/anchors";

interface AnchorEditorProps {
  type: Exclude<JewelleryType, "set">;
  imageUrl: string;
  anchors: AnchorMap;
  onChange: (anchors: AnchorMap) => void;
}

const CANVAS_W = 640;
const CANVAS_H = 480;

/** Click-to-place anchor editor for try-on cut-outs. Coordinates are stored normalised (0..1). */
export function AnchorEditor({ type, imageUrl, anchors, onChange }: AnchorEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spec = ANCHOR_SPECS[type];
  const order = useMemo(() => [...spec.required, ...spec.optional], [spec]);
  const pending = nextAnchor(type, anchors);
  const missing = missingAnchors(type, anchors);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError("The image couldn't be loaded for anchor editing.");
    img.src = imageUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  const fit = useMemo(() => (image ? fitImage(image.naturalWidth, image.naturalHeight, CANVAS_W, CANVAS_H) : null), [image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !fit) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // checkerboard so transparency is visible
    for (let y = 0; y < CANVAS_H; y += 16) {
      for (let x = 0; x < CANVAS_W; x += 16) {
        ctx.fillStyle = ((x + y) / 16) % 2 === 0 ? "#efe9df" : "#e3dccf";
        ctx.fillRect(x, y, 16, 16);
      }
    }
    ctx.drawImage(image, fit.offsetX, fit.offsetY, fit.width, fit.height);
    for (const [name, point] of Object.entries(anchors)) {
      const [x, y] = normalisedToCanvas(point, fit);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = spec.required.includes(name) ? "#8a6a2b" : "#0f5c4a";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#1b1a17";
      ctx.fillText(anchorLabel(name), x + 10, y - 8);
    }
  }, [image, fit, anchors, spec.required]);

  const place = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !fit || !pending) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_H;
    const point = canvasToNormalised(x, y, fit);
    if (!point) return;
    onChange({ ...anchors, [pending]: point });
  };

  const undo = () => {
    const placed = order.filter((n) => n in anchors);
    const last = placed[placed.length - 1];
    if (!last) return;
    const next = { ...anchors };
    delete next[last];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-fg-muted text-sm">{spec.hint}</p>
      <p className="text-sm" aria-live="polite">
        {pending ? (
          <>
            Next: <strong>{anchorLabel(pending)}</strong>
            {spec.optional.includes(pending) && <span className="text-fg-muted"> (optional)</span>}
          </>
        ) : (
          <span className="text-success">All anchors placed.</span>
        )}
      </p>
      {error ? (
        <p role="alert" className="text-danger text-sm">{error}</p>
      ) : (
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          role="img"
          aria-label={`Anchor editor. Click to place the ${pending ? anchorLabel(pending) : "anchors"}.`}
          tabIndex={0}
          onClick={(e) => place(e.clientX, e.clientY)}
          className="border-border-strong w-full max-w-[640px] cursor-crosshair rounded-md border"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={undo} disabled={Object.keys(anchors).length === 0} leftIcon={<Undo2 className="size-4" aria-hidden />}>
          Undo last
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange({})} disabled={Object.keys(anchors).length === 0} leftIcon={<RotateCcw className="size-4" aria-hidden />}>
          Clear
        </Button>
        <ul className="text-fg-muted ml-auto flex flex-wrap gap-x-3 text-xs">
          {order.map((name) => (
            <li key={name} className={name in anchors ? "text-fg" : ""}>
              {name in anchors ? "●" : "○"} {anchorLabel(name)}
              {spec.optional.includes(name) && " (opt.)"}
            </li>
          ))}
        </ul>
      </div>
      {missing.length > 0 && <p className="text-warning text-xs">Still needed: {missing.map(anchorLabel).join(", ")}.</p>}
    </div>
  );
}
