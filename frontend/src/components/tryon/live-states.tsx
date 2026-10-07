import { Camera, CameraOff, LoaderCircle, MonitorX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { LiveStatus } from "@/lib/tryon/live/use-live-tryon";

interface LiveStateOverlayProps {
  status: LiveStatus;
  progress: string;
  onStart: () => void;
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="text-ivory absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      {icon}
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}

/** Full-frame messaging for every non-running camera state. */
export function LiveStateOverlay({ status, progress, onStart }: LiveStateOverlayProps) {
  switch (status) {
    case "running":
      return null;
    case "starting":
    case "loading-models":
      return (
        <Panel
          icon={<LoaderCircle className="text-gold-bright size-8 animate-spin" aria-hidden />}
          title={status === "starting" ? "Starting camera…" : "Preparing try-on…"}
        >
          <p className="text-ivory/70 max-w-xs text-sm" aria-live="polite">
            {status === "loading-models"
              ? progress || "Loading vision models (first time only)…"
              : "Allow camera access when your browser asks."}
          </p>
        </Panel>
      );
    case "denied":
      return (
        <Panel
          icon={<CameraOff className="text-gold-bright size-8" aria-hidden />}
          title="Camera access was blocked"
        >
          <p className="text-ivory/70 max-w-xs text-sm">
            Allow camera access for this site in your browser settings, then try again. You can also
            upload a photo instead.
          </p>
          <Button
            variant="primary"
            onClick={onStart}
            leftIcon={<Camera className="size-4" aria-hidden />}
          >
            Try again
          </Button>
        </Panel>
      );
    case "no-camera":
      return (
        <Panel
          icon={<CameraOff className="text-gold-bright size-8" aria-hidden />}
          title="No camera available"
        >
          <p className="text-ivory/70 max-w-xs text-sm">
            This device or browser doesn&apos;t provide a camera. Upload a photo to continue.
          </p>
        </Panel>
      );
    case "unsupported":
      return (
        <Panel
          icon={<MonitorX className="text-gold-bright size-8" aria-hidden />}
          title="Live try-on isn't supported here"
        >
          <p className="text-ivory/70 max-w-xs text-sm">
            Your browser can&apos;t run the on-device vision models (WebGL or WebAssembly is
            unavailable). Photo try-on still works.
          </p>
        </Panel>
      );
    case "models-failed":
      return (
        <Panel
          icon={<MonitorX className="text-gold-bright size-8" aria-hidden />}
          title="We couldn't load the try-on models"
        >
          <p className="text-ivory/70 max-w-xs text-sm">
            Check your connection and try again, or use photo try-on.
          </p>
          <Button
            variant="primary"
            onClick={onStart}
            leftIcon={<Camera className="size-4" aria-hidden />}
          >
            Try again
          </Button>
        </Panel>
      );
    default:
      return (
        <Panel
          icon={<Camera className="text-gold-bright size-8" aria-hidden />}
          title="Live try-on"
        >
          <p className="text-ivory/70 max-w-xs text-sm">
            Jewellery follows you in real time. The video never leaves your device; only a frame you
            capture is sent to render the final result.
          </p>
          <Button
            variant="primary"
            onClick={onStart}
            leftIcon={<Camera className="size-4" aria-hidden />}
          >
            Start camera
          </Button>
        </Panel>
      );
  }
}
