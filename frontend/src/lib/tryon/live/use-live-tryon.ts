"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JewelleryType, ProductDetail } from "@/lib/api/types";
import { anchorsFor, detectorsNeeded } from "../fitting/anchors";
import { fitAsset } from "../fitting/fitters";
import { AnchorError, type Adjustments } from "../fitting/types";
import type { LookItem } from "../session";
import { assetGeometry, loadDrawable, selectAsset, tintFor } from "./assets";
import { LiveDetectors, liveSupport, type Delegate } from "./landmarkers";
import { captureFrame, drawPlacements } from "./renderer";
import { LandmarkSmoother } from "./smoothing";
import type { Facing, LiveItem, LivePlacement, LiveQuality, LiveStats } from "./types";

export type LiveStatus =
  | "idle"
  | "starting"
  | "loading-models"
  | "running"
  | "denied"
  | "no-camera"
  | "unsupported"
  | "models-failed";

const TARGET_FRAME_MS = 1000 / 24;

interface UseLiveTryOnArgs {
  items: LookItem[];
  details: Record<string, ProductDetail | undefined>;
  quality: LiveQuality;
}

/**
 * Drives the live camera try-on: camera stream, lazy MediaPipe detectors, per-frame fitting
 * and canvas overlay. All resources are released on stop()/unmount.
 */
export function useLiveTryOn({ items, details, quality }: UseLiveTryOnArgs) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);
  const attachCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorsRef = useRef<LiveDetectors | null>(null);
  const smootherRef = useRef(new LandmarkSmoother());
  const liveItemsRef = useRef<LiveItem[]>([]);
  const placementsRef = useRef<LivePlacement[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const facingRef = useRef<Facing>("user");
  const statsSample = useRef<{ frames: number; ms: number; since: number }>({
    frames: 0,
    ms: 0,
    since: 0,
  });

  const [status, setStatus] = useState<LiveStatus>("idle");
  const [progress, setProgress] = useState<string>("");
  const [facing, setFacing] = useState<Facing>("user");
  const [missing, setMissing] = useState<JewelleryType[]>([]);
  const [stats, setStats] = useState<LiveStats>({ fps: 0, inferenceMs: 0, delegate: "GPU" });
  const [assetProblem, setAssetProblem] = useState<string | null>(null);

  const types = items.map((i) => i.product.jewellery_type);
  const needsKey = JSON.stringify(detectorsNeeded(types));

  // Build drawable live items whenever the look or details change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const built: LiveItem[] = [];
      let problem: string | null = null;
      for (const item of items) {
        const detail = details[item.product.slug];
        if (!detail) continue;
        const asset = selectAsset(detail, item.variantId);
        if (!asset) {
          problem = `${detail.name} doesn't have a try-on image yet.`;
          continue;
        }
        const variant = detail.variants.find((v) => v.id === item.variantId) ?? null;
        try {
          const drawable = await loadDrawable(asset, tintFor(asset, variant));
          built.push({
            product: detail,
            variant,
            slot: item.slot,
            adjustments: item.adjustments,
            geometry: assetGeometry(detail, asset),
            drawable,
          });
        } catch {
          problem = `${detail.name}'s try-on image couldn't be loaded.`;
        }
      }
      if (!cancelled) {
        liveItemsRef.current = built;
        setAssetProblem(problem);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, details]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorsRef.current?.close();
    detectorsRef.current = null;
    smootherRef.current.reset();
    placementsRef.current = [];
    if (videoRef.current) videoRef.current.srcObject = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    setStatus("idle");
    setMissing([]);
  }, [stopLoop]);

  useEffect(() => () => stop(), [stop]);

  // The per-frame loop re-schedules itself through a ref so the callback can stay stable.
  const loopRef = useRef<(now: number) => void>(() => {});
  const tick = useCallback((now: number) => loopRef.current(now), []);

  const frame = useCallback(
    (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detectors = detectorsRef.current;
      if (!video || !canvas || !detectors || video.readyState < 2) return;
      if (now - lastFrameRef.current < TARGET_FRAME_MS) return;
      lastFrameRef.current = now;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const mirrored = facingRef.current === "user";
      const started = performance.now();
      const raw = detectors.detect(video, now, mirrored);
      const landmarks = smootherRef.current.apply(raw, now);
      const placements: LivePlacement[] = [];
      const missingNow: JewelleryType[] = [];
      for (const item of liveItemsRef.current) {
        try {
          for (const anchors of anchorsFor(landmarks, item.product.jewellery_type, item.slot)) {
            placements.push({
              item,
              placement: fitAsset(
                item.geometry,
                anchors,
                landmarks.image_width,
                landmarks.image_height,
                item.adjustments,
              ),
            });
          }
        } catch (error) {
          if (error instanceof AnchorError) missingNow.push(item.product.jewellery_type);
          else throw error;
        }
      }
      placementsRef.current = placements;
      const ctx = canvas.getContext("2d");
      if (ctx) drawPlacements(ctx, placements);
      const elapsed = performance.now() - started;
      const sample = statsSample.current;
      sample.frames += 1;
      sample.ms += elapsed;
      if (now - sample.since > 1000) {
        setStats({
          fps: Math.round((sample.frames * 1000) / Math.max(1, now - sample.since)),
          inferenceMs: Math.round(sample.ms / Math.max(1, sample.frames)),
          delegate: detectors.delegate,
        });
        setMissing((prev) => (prev.join() === missingNow.join() ? prev : missingNow));
        statsSample.current = { frames: 0, ms: 0, since: now };
      }
    },
    [tick],
  );

  useEffect(() => {
    loopRef.current = frame;
  }, [frame]);

  const start = useCallback(
    async (nextFacing: Facing = facingRef.current) => {
      const support = liveSupport();
      if (!support.ok) {
        setStatus(support.reason === "camera" ? "no-camera" : "unsupported");
        return;
      }
      stopLoop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setStatus("starting");
      facingRef.current = nextFacing;
      setFacing(nextFacing);
      const resolution = quality === "low" ? 640 : quality === "high" ? 1280 : 960;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextFacing,
            width: { ideal: resolution },
            height: { ideal: resolution },
          },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
      } catch (error) {
        const denied =
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "SecurityError");
        setStatus(denied ? "denied" : "no-camera");
        return;
      }
      if (!detectorsRef.current || JSON.stringify(detectorsRef.current.needs) !== needsKey) {
        setStatus("loading-models");
        detectorsRef.current?.close();
        detectorsRef.current = null;
        const delegate: Delegate = quality === "low" ? "CPU" : "GPU";
        try {
          detectorsRef.current = await LiveDetectors.load({
            needs: JSON.parse(needsKey) as ReturnType<typeof detectorsNeeded>,
            delegate,
            onProgress: setProgress,
          });
        } catch {
          setStatus("models-failed");
          return;
        }
      }
      smootherRef.current.reset();
      statsSample.current = { frames: 0, ms: 0, since: performance.now() };
      setStatus("running");
      rafRef.current = requestAnimationFrame(tick);
    },
    [needsKey, quality, stopLoop, tick],
  );

  // Reload detectors when the required set changes while running.
  useEffect(() => {
    if (
      status === "running" &&
      detectorsRef.current &&
      JSON.stringify(detectorsRef.current.needs) !== needsKey
    ) {
      void start(facingRef.current);
    }
  }, [needsKey, start, status]);

  const switchCamera = useCallback(() => {
    void start(facingRef.current === "user" ? "environment" : "user");
  }, [start]);

  const capture = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    return captureFrame(video, placementsRef.current, facingRef.current === "user");
  }, []);

  const updateAdjustments = useCallback((productId: string, adjustments: Adjustments) => {
    liveItemsRef.current = liveItemsRef.current.map((i) =>
      i.product.id === productId ? { ...i, adjustments } : i,
    );
  }, []);

  return {
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
    capture,
    updateAdjustments,
  };
}
