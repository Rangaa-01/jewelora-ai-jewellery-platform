"use client";

import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useAssetQuality, type AssetQualityCheck } from "@/lib/admin/hooks";
import { cn } from "@/lib/utils";
import { Card, QueryState } from "./primitives";

const ICONS = { pass: CircleCheck, warn: CircleAlert, fail: CircleX } as const;
const TONES = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-danger",
} as const;

/** Catalogue asset quality: a score plus each check with the fix in plain language. */
export function AssetQualityCard({ productId }: { productId: string }) {
  const query = useAssetQuality(productId);
  return (
    <Card title="Asset quality">
      <QueryState isPending={query.isPending} error={query.error} onRetry={() => query.refetch()}>
        {query.data && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <p
                className="font-display text-4xl"
                aria-label={`Quality score ${query.data.score}%`}
              >
                {query.data.score}%
              </p>
              <div className="flex-1">
                <div
                  className="bg-bg-muted h-2 overflow-hidden rounded-full"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={query.data.score}
                  aria-label="Asset quality"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      query.data.score >= 80
                        ? "bg-success"
                        : query.data.score >= 55
                          ? "bg-warning"
                          : "bg-danger",
                    )}
                    style={{ width: `${query.data.score}%` }}
                  />
                </div>
                <p className="text-fg-muted mt-1 text-xs">
                  {query.data.tryon_ready
                    ? "Try-on ready: customers see “Try It On”."
                    : "Not try-on ready yet: fix the red items below."}
                </p>
              </div>
            </div>
            <ul className="divide-border flex flex-col divide-y">
              {query.data.checks.map((check) => (
                <CheckRow key={check.key} check={check} />
              ))}
            </ul>
          </div>
        )}
      </QueryState>
    </Card>
  );
}

function CheckRow({ check }: { check: AssetQualityCheck }) {
  const Icon = ICONS[check.status];
  return (
    <li className="flex items-start gap-3 py-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONES[check.status])} aria-hidden />
      <div>
        <p className="font-medium">
          {check.label}
          <span className="sr-only"> — {check.status}</span>
        </p>
        <p className="text-fg-muted text-xs">{check.detail}</p>
      </div>
    </li>
  );
}
