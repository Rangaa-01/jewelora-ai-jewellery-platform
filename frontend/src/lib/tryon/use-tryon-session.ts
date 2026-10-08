"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import type { Adjustments } from "./fitting/types";
import {
  buildItemsPayload,
  debounce,
  type LookItem,
  type TryOnMode,
  type TryOnQuality,
  type TryOnResult,
} from "./session";

const ADJUST_DEBOUNCE_MS = 350;

/**
 * Owns the photo try-on lifecycle: run on a file, re-run on the stored photo, and
 * debounced manual adjustments. Keeps the previous result visible while a new one loads.
 */
export function useTryOnSession(mode: TryOnMode) {
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    },
    [originalUrl],
  );

  const run = useMutation({
    mutationFn: async ({
      file,
      items,
      quality = "standard",
    }: {
      file: File;
      items: LookItem[];
      quality?: TryOnQuality;
    }) => {
      const form = new FormData();
      form.append("photo", file);
      form.append("mode", mode);
      form.append("quality", quality);
      form.append("items", JSON.stringify(buildItemsPayload(items)));
      form.append("device", JSON.stringify({ ua: navigator.userAgent.slice(0, 200) }));
      return api.upload<TryOnResult>("/tryon/photo", form);
    },
    onMutate: ({ file }) => {
      setOriginalUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    onSuccess: (r) => setResult(r),
  });

  const rerun = useMutation({
    mutationFn: async ({
      photoId,
      items,
      quality = "standard",
    }: {
      photoId: string;
      items: LookItem[];
      quality?: TryOnQuality;
    }) =>
      api.post<TryOnResult>(`/tryon/photos/${photoId}/run`, {
        items: buildItemsPayload(items),
        mode,
        quality,
      }),
    onSuccess: (r) => setResult(r),
  });

  /** Re-render the current look at full resolution for saving, sharing and download. */
  const premium = useMutation({
    mutationFn: async (resultId: string) =>
      api.post<TryOnResult>(`/tryon/results/${resultId}/premium`, {}),
    onSuccess: (r) => setResult(r),
  });

  const adjust = useMutation({
    mutationFn: async ({
      resultId,
      adjustments,
    }: {
      resultId: string;
      adjustments: Record<string, Adjustments>;
    }) => api.post<TryOnResult>(`/tryon/results/${resultId}/adjust`, adjustments),
    onSuccess: (r) => setResult(r),
  });

  const adjustNow = adjust.mutate;
  const debouncedAdjust = useMemo(
    () =>
      debounce((resultId: string, adjustments: Record<string, Adjustments>) => {
        adjustNow({ resultId, adjustments });
      }, ADJUST_DEBOUNCE_MS),
    [adjustNow],
  );
  useEffect(() => () => debouncedAdjust.cancel(), [debouncedAdjust]);

  const reset = useCallback(() => {
    debouncedAdjust.cancel();
    setResult(null);
    setOriginalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [debouncedAdjust]);

  return {
    result,
    originalUrl,
    run,
    rerun,
    adjust,
    premium,
    scheduleAdjust: debouncedAdjust,
    reset,
    isBusy: run.isPending || rerun.isPending || adjust.isPending || premium.isPending,
  };
}
