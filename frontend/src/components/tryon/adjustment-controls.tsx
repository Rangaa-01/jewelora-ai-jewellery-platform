"use client";

import { RotateCcw } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_ADJUSTMENTS, type Adjustments } from "@/lib/tryon/fitting/types";

export interface AdjustableItem {
  id: string;
  label: string;
}

interface AdjustmentControlsProps {
  items: AdjustableItem[];
  values: Record<string, Adjustments>;
  onChange: (id: string, next: Adjustments) => void;
  /** Pixel range for the offset sliders (defaults suit photos ~1000 px wide). */
  offsetRange?: number;
  disabled?: boolean;
}

const SLIDERS: Array<{
  key: keyof Adjustments;
  label: string;
  min: (range: number) => number;
  max: (range: number) => number;
  step: number;
  format: (v: number) => string;
}> = [
  {
    key: "offset_x",
    label: "Move left / right",
    min: (r) => -r,
    max: (r) => r,
    step: 1,
    format: (v) => `${Math.round(v)} px`,
  },
  {
    key: "offset_y",
    label: "Move up / down",
    min: (r) => -r,
    max: (r) => r,
    step: 1,
    format: (v) => `${Math.round(v)} px`,
  },
  {
    key: "scale",
    label: "Size",
    min: () => 0.5,
    max: () => 2,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "rotation_deg",
    label: "Tilt",
    min: () => -45,
    max: () => 45,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}°`,
  },
];

/** Per-piece manual fine-tuning (offset, size, tilt) applied on top of the automatic fit. */
export function AdjustmentControls({
  items,
  values,
  onChange,
  offsetRange = 200,
  disabled = false,
}: AdjustmentControlsProps) {
  const baseId = useId();
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const current = values[item.id] ?? DEFAULT_ADJUSTMENTS;
        const dirty = JSON.stringify(current) !== JSON.stringify(DEFAULT_ADJUSTMENTS);
        return (
          <fieldset
            key={item.id}
            className="border-border rounded-md border p-3"
            disabled={disabled}
          >
            <legend className="px-1 text-sm font-medium">{item.label}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {SLIDERS.map((s) => {
                const id = `${baseId}-${item.id}-${s.key}`;
                const value = current[s.key];
                return (
                  <div key={s.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor={id} className="text-fg-soft">
                        {s.label}
                      </label>
                      <output htmlFor={id} className="text-fg-muted tabular-nums">
                        {s.format(value)}
                      </output>
                    </div>
                    <input
                      id={id}
                      type="range"
                      min={s.min(offsetRange)}
                      max={s.max(offsetRange)}
                      step={s.step}
                      value={value}
                      onChange={(e) =>
                        onChange(item.id, { ...current, [s.key]: Number(e.target.value) })
                      }
                      className="accent-gold-deep h-11 w-full cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                leftIcon={<RotateCcw className="size-3.5" aria-hidden />}
                onClick={() => onChange(item.id, DEFAULT_ADJUSTMENTS)}
              >
                Reset {item.label}
              </Button>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
