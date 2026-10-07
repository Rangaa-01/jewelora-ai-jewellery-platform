"use client";

import { Download, Heart, Save, Share2, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { AdjustmentControls } from "./adjustment-controls";
import { RingSizeCard } from "./ring-size-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Adjustments } from "@/lib/tryon/fitting/types";
import type { LookItem, TryOnMode, TryOnResult } from "@/lib/tryon/session";
import { SaveLookDialog } from "@/components/looks/save-look-dialog";
import { useAddWishlistItem, useOwnerKey, useWishlist } from "@/lib/api/hooks";
import { useUiStore } from "@/lib/stores/ui-store";

interface ResultPanelProps {
  result: TryOnResult;
  originalUrl: string | null;
  items: LookItem[];
  mode?: TryOnMode;
  busy: boolean;
  onAdjust: (productId: string, adjustments: Adjustments) => void;
  onChangePhoto: () => void;
  onTryAnother: () => void;
}

/** The rendered try-on with before/after, fine-tuning, ring size and the look actions. */
export function ResultPanel({
  result,
  originalUrl,
  items,
  mode = "look",
  busy,
  onAdjust,
  onChangePhoto,
  onTryAnother,
}: ResultPanelProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const { toast } = useToast();
  const { signedIn } = useOwnerKey();
  const wishlist = useWishlist();
  const addWishlistItem = useAddWishlistItem();
  const requestSignIn = useUiStore((s) => s.requestSignIn);
  const lookItems = items.map((item) => ({
    product_id: item.product.id,
    variant_id: item.variantId,
    slot: item.slot ?? item.product.jewellery_type,
    adjustments: item.adjustments,
  }));

  const addAllToWishlist = async () => {
    const existing = new Set(wishlist.data?.items.map((i) => i.product?.id) ?? []);
    const missing = items.filter((i) => !existing.has(i.product.id));
    try {
      for (const item of missing) {
        await addWishlistItem.mutateAsync({
          product_id: item.product.id,
          variant_id: item.variantId,
        });
      }
      toast({
        title: missing.length ? "Added to your wishlist" : "Already in your wishlist",
        description: `${items.length} ${items.length === 1 ? "piece" : "pieces"} from this look`,
        tone: "success",
      });
    } catch {
      toast({
        title: "Couldn't update your wishlist",
        description: "Please try again.",
        tone: "error",
      });
    }
  };

  const requireSignIn = (message: string, next: () => void) => {
    if (signedIn) next();
    else requestSignIn({ message, onSuccess: next });
  };
  const placedIds = new Set(result.placements.map((p) => p.product_id));
  const adjustable = items.filter((i) => placedIds.has(i.product.id));
  const values = Object.fromEntries(
    result.items.map((i) => [i.product_id, i.adjustments] as const),
  );
  const width = result.width ?? 4;
  const height = result.height ?? 3;
  const imageUrl = showOriginal && originalUrl ? originalUrl : result.result_url;

  const share = async () => {
    if (!result.result_url) return;
    try {
      if (navigator.share)
        await navigator.share({ title: "My Jewelora look", url: result.result_url });
      else {
        await navigator.clipboard.writeText(window.location.origin + result.result_url);
        toast({ title: "Link copied", tone: "success" });
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="bg-bg-muted relative overflow-hidden rounded-lg"
        style={{ aspectRatio: `${width} / ${height}` }}
        aria-busy={busy}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={showOriginal ? "Your original photo" : "Your try-on result"}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-contain"
            unoptimized
          />
        )}
        {busy && (
          <div className="bg-bg/40 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-bg-elevated rounded-full px-3 py-1 text-xs shadow">
              Updating fit…
            </span>
          </div>
        )}
        {originalUrl && (
          <button
            type="button"
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setShowOriginal((v) => !v);
              }
            }}
            aria-pressed={showOriginal}
            className="bg-bg-elevated/90 text-fg hover:bg-bg-elevated absolute right-3 bottom-3 h-11 rounded-full px-4 text-xs font-medium shadow"
          >
            {showOriginal ? "Showing original" : "Hold to compare"}
          </button>
        )}
      </div>

      {result.warnings.length > 0 && (
        <ul
          className="border-gold/40 bg-gold/5 flex flex-col gap-1 rounded-md border p-3 text-sm"
          aria-label="Notes"
        >
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {result.confidence !== null && result.confidence < 0.6 && (
        <p className="text-fg-muted text-sm">
          Detection confidence was low for this photo. A front-facing photo in even light gives a
          more accurate fit.
        </p>
      )}
      {result.ring_size_estimate && <RingSizeCard estimate={result.ring_size_estimate} />}

      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          leftIcon={<SlidersHorizontal className="size-4" aria-hidden />}
          onClick={() => setShowAdjust((v) => !v)}
          aria-expanded={showAdjust}
          disabled={adjustable.length === 0}
        >
          {showAdjust ? "Hide fine-tuning" : "Fine-tune the fit"}
        </Button>
        {showAdjust && (
          <AdjustmentControls
            items={adjustable.map((i) => ({ id: i.product.id, label: i.product.name }))}
            values={values}
            onChange={onAdjust}
            offsetRange={Math.round(Math.max(width, height) * 0.25)}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          leftIcon={<Save className="size-4" aria-hidden />}
          onClick={() =>
            requireSignIn("Sign in to save this look to your account.", () => setSaveOpen(true))
          }
        >
          Save Look
        </Button>
        <SaveLookDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          tryonResultId={result.id}
          items={lookItems}
          kind={mode}
          defaultTitle={mode === "bridal" ? "My bridal look" : "My look"}
          onSaved={() => setSaveOpen(false)}
        />
        <Button
          variant="outline"
          leftIcon={<Share2 className="size-4" aria-hidden />}
          onClick={() => void share()}
        >
          Share Look
        </Button>
        {result.result_url && (
          <a
            href={result.result_url}
            download
            className="border-border-strong hover:border-fg inline-flex h-11 items-center gap-2 rounded-sm border px-6 text-sm font-medium"
          >
            <Download className="size-4" aria-hidden /> Download
          </a>
        )}
        <Button
          variant="ghost"
          leftIcon={<Heart className="size-4" aria-hidden />}
          loading={addWishlistItem.isPending}
          onClick={() =>
            requireSignIn("Sign in to keep these pieces in your wishlist.", () => {
              void addAllToWishlist();
            })
          }
        >
          Add All to Wishlist
        </Button>
        <ButtonLink
          href={`/appointments/new?products=${items.map((i) => i.product.slug).join(",")}`}
          variant="ghost"
        >
          Book Appointment
        </ButtonLink>
        <Button variant="ghost" onClick={onTryAnother} disabled={busy}>
          Try other pieces on this photo
        </Button>
        <Button variant="ghost" onClick={onChangePhoto}>
          Change photo
        </Button>
      </div>
    </div>
  );
}
