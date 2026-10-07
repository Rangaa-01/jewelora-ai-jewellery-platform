import { Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RingSizeEstimate } from "@/lib/tryon/session";

/** Shows the photo-derived ring size, always labelled as an estimate. */
export function RingSizeCard({ estimate }: { estimate: RingSizeEstimate }) {
  const finger = estimate.finger === "pinky" ? "little finger" : `${estimate.finger} finger`;
  return (
    <aside
      aria-labelledby="ring-size-heading"
      className="border-gold/40 bg-gold/5 flex flex-col gap-2 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="ring-size-heading" className="inline-flex items-center gap-2 text-base font-medium">
          <Ruler className="text-accent-text size-4" aria-hidden /> Ring size
        </h3>
        <Badge tone="gold">Estimate — confirm in store</Badge>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-fg-muted text-xs">Indian size</dt>
          <dd className="font-display text-2xl">{estimate.indian_size}</dd>
        </div>
        <div>
          <dt className="text-fg-muted text-xs">US size</dt>
          <dd className="font-display text-2xl">{estimate.us_size}</dd>
        </div>
        <div>
          <dt className="text-fg-muted text-xs">Inner diameter</dt>
          <dd className="font-display text-2xl">{estimate.inner_diameter_mm.toFixed(1)} mm</dd>
        </div>
      </dl>
      <p className="text-fg-muted text-xs">
        Measured on your {estimate.handedness.toLowerCase()} {finger}
        {estimate.confidence === "low" ? " (low confidence)" : ""}. {estimate.note}
      </p>
    </aside>
  );
}
