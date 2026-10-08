"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The real stages of the photo pipeline, shown while the server works. The server doesn't
 * stream progress, so the current step advances on typical timings and the last step waits
 * for the actual response; there are no percentages.
 */
const STAGES = [
  "Analysing your photo",
  "Understanding your pose",
  "Fitting the jewellery",
  "Matching the light",
  "Finishing your look",
];
const STEP_MS = 650;

export function ProcessingStages({ active, hd = false }: { active: boolean; hd?: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const elapsed = performance.now() - started;
      setStep(Math.min(STAGES.length - 1, Math.floor(elapsed / (hd ? STEP_MS * 1.6 : STEP_MS))));
    }, 120);
    return () => {
      window.clearInterval(id);
      setStep(0);
    };
  }, [active, hd]);
  if (!active) return null;
  return (
    <ol className="flex flex-col gap-2 text-sm" aria-live="polite" aria-label="Creating your look">
      {STAGES.map((label, i) => (
        <li
          key={label}
          className={cn(
            "flex items-center gap-2 transition-colors",
            i < step ? "text-fg-muted" : i === step ? "text-fg font-medium" : "text-fg-muted/50",
          )}
          aria-current={i === step ? "step" : undefined}
        >
          <span
            className={cn(
              "inline-flex size-5 items-center justify-center rounded-full border",
              i < step
                ? "border-gold-deep bg-gold-deep text-ivory"
                : i === step
                  ? "border-gold-deep"
                  : "border-border",
            )}
            aria-hidden
          >
            {i < step ? (
              <Check className="size-3" />
            ) : i === step ? (
              <span className="bg-gold-deep size-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
            ) : null}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}
