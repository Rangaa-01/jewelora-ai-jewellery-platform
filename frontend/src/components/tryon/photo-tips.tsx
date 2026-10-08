import { Lightbulb } from "lucide-react";
import type { PhotoTip } from "@/lib/tryon/session";

/** Gentle, non-blocking advice about the customer's photo. */
export function PhotoTips({ tips }: { tips: PhotoTip[] }) {
  if (tips.length === 0) return null;
  return (
    <ul
      className="border-border bg-bg-elevated flex flex-col gap-2 rounded-md border p-3 text-sm"
      aria-label="Tips for an even better result"
    >
      {tips.map((tip) => (
        <li key={tip.code} className="flex items-start gap-2">
          <Lightbulb className="text-accent-text mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{tip.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** Photo tips carried by a failed try-on's error details, if any. */
export function tipsFromError(error: unknown): PhotoTip[] {
  const details = (error as { details?: unknown } | null)?.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const tips = (details as { photo_tips?: unknown }).photo_tips;
  return Array.isArray(tips) ? (tips as PhotoTip[]) : [];
}
