"use client";

import { Camera, CameraOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type CameraState = "idle" | "requesting" | "active" | "denied" | "unavailable";

/**
 * Opens the device camera and captures a still frame as a File. Video never leaves the
 * browser; only the frame the customer explicitly captures is handed to the caller.
 */
export function CameraCapture({
  onCapture,
  facing = "user",
}: {
  onCapture: (file: File) => void;
  facing?: "user" | "environment";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">(facing);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("requesting");
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("active");
    } catch (error) {
      setState(
        error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "SecurityError")
          ? "denied"
          : "unavailable",
      );
    }
  }, [facingMode, stop]);

  useEffect(() => () => stop(), [stop]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-ink relative aspect-[3/4] max-h-[70vh] w-full overflow-hidden rounded-lg">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`size-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""} ${state === "active" ? "" : "hidden"}`}
          aria-label="Live camera preview"
        />
        {state !== "active" && (
          <div className="text-ivory absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === "denied" ? (
              <>
                <CameraOff className="text-gold-bright size-8" aria-hidden />
                <p className="font-medium">Camera access was blocked</p>
                <p className="text-ivory/70 max-w-xs text-sm">
                  Allow camera access for this site in your browser settings, then try again. You
                  can also upload a photo instead.
                </p>
              </>
            ) : state === "unavailable" ? (
              <>
                <CameraOff className="text-gold-bright size-8" aria-hidden />
                <p className="font-medium">No camera available</p>
                <p className="text-ivory/70 max-w-xs text-sm">
                  This device or browser doesn&apos;t provide a camera. Upload a photo to continue.
                </p>
              </>
            ) : (
              <>
                <Camera className="text-gold-bright size-8" aria-hidden />
                <p className="font-medium">Use your camera</p>
                <p className="text-ivory/70 max-w-xs text-sm">
                  The preview stays on your device. Only the frame you capture is used for try-on.
                </p>
              </>
            )}
            {state !== "unavailable" && (
              <Button
                variant="primary"
                onClick={() => void start()}
                loading={state === "requesting"}
                leftIcon={<Camera className="size-4" aria-hidden />}
              >
                {state === "denied" ? "Try again" : "Open camera"}
              </Button>
            )}
          </div>
        )}
      </div>
      {state === "active" && (
        <div className="flex gap-2">
          <Button
            onClick={capture}
            size="lg"
            className="flex-1"
            leftIcon={<Camera className="size-5" aria-hidden />}
          >
            Capture
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Switch camera"
            onClick={() => {
              setFacingMode((f) => (f === "user" ? "environment" : "user"));
              setTimeout(() => void start(), 0);
            }}
          >
            <RefreshCw className="size-5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              stop();
              setState("idle");
            }}
          >
            Stop
          </Button>
        </div>
      )}
    </div>
  );
}
