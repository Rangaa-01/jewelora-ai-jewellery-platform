import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "gold" | "emerald" | "neutral" | "rose" | "danger" | "inverse";

const tones: Record<Tone, string> = {
  gold: "bg-gold/15 text-gold-ink dark:text-gold-bright border-gold/40",
  emerald: "bg-emerald-soft text-emerald-deep dark:text-emerald-soft border-emerald/30",
  neutral: "bg-bg-muted text-fg-soft border-border",
  rose: "bg-rose-gold-soft text-gold-ink border-rose-gold/50",
  danger: "bg-danger-soft text-danger border-danger/30",
  inverse: "bg-bg-inverse text-fg-inverse border-transparent",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-[0.7rem] font-semibold tracking-[0.12em] uppercase",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
