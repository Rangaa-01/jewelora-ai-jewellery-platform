/**
 * MediaPipe Tasks Vision wrapper for live detection. Loaded lazily (dynamic import) so
 * nothing from MediaPipe lands in the initial route bundle. Produces `Landmarks` in the
 * coordinate space of the *displayed* frame: when the preview is mirrored (selfie camera)
 * x is flipped, so "image-left/right" region names match what the customer sees.
 */

import type { Hand, Landmarks, Point } from "../fitting/types";

type Vision = typeof import("@mediapipe/tasks-vision");

export const MEDIAPIPE_VERSION = "1.1.0";
// Served same-origin from public/mediapipe/wasm (copied by scripts/copy-mediapipe-wasm.mjs).
export const WASM_BASE = "/mediapipe/wasm";
export const MODELS_BASE = "/models";

export interface DetectorNeeds {
  face: boolean;
  hands: boolean;
  pose: boolean;
}

export type Delegate = "GPU" | "CPU";

export interface DetectorLoadOptions {
  needs: DetectorNeeds;
  delegate: Delegate;
  onProgress?: (label: string) => void;
}

function toPoints(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
  mirrored: boolean,
): Point[] {
  return landmarks.map((p) => ({ x: mirrored ? (1 - p.x) * width : p.x * width, y: p.y * height }));
}

export class LiveDetectors {
  private face: import("@mediapipe/tasks-vision").FaceLandmarker | null = null;
  private hands: import("@mediapipe/tasks-vision").HandLandmarker | null = null;
  private pose: import("@mediapipe/tasks-vision").PoseLandmarker | null = null;
  private lastTimestamp = -1;
  readonly delegate: Delegate;
  readonly needs: DetectorNeeds;

  private constructor(needs: DetectorNeeds, delegate: Delegate) {
    this.needs = needs;
    this.delegate = delegate;
  }

  /** Loads the WASM runtime and the requested landmarkers. Falls back to CPU if GPU init fails. */
  static async load(options: DetectorLoadOptions): Promise<LiveDetectors> {
    const vision: Vision = await import("@mediapipe/tasks-vision");
    options.onProgress?.("Loading vision runtime…");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
    try {
      return await LiveDetectors.create(vision, fileset, options, options.delegate);
    } catch (error) {
      if (options.delegate === "GPU") {
        options.onProgress?.("Switching to CPU…");
        return LiveDetectors.create(vision, fileset, options, "CPU");
      }
      throw error;
    }
  }

  private static async create(
    vision: Vision,
    fileset: Awaited<ReturnType<Vision["FilesetResolver"]["forVisionTasks"]>>,
    options: DetectorLoadOptions,
    delegate: Delegate,
  ): Promise<LiveDetectors> {
    const detectors = new LiveDetectors(options.needs, delegate);
    const common = { runningMode: "VIDEO" as const };
    if (options.needs.face) {
      options.onProgress?.("Loading face model…");
      detectors.face = await vision.FaceLandmarker.createFromOptions(fileset, {
        ...common,
        baseOptions: { modelAssetPath: `${MODELS_BASE}/face_landmarker.task`, delegate },
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
      });
    }
    if (options.needs.hands) {
      options.onProgress?.("Loading hand model…");
      detectors.hands = await vision.HandLandmarker.createFromOptions(fileset, {
        ...common,
        baseOptions: { modelAssetPath: `${MODELS_BASE}/hand_landmarker.task`, delegate },
        numHands: 2,
        minHandDetectionConfidence: 0.4,
      });
    }
    if (options.needs.pose) {
      options.onProgress?.("Loading pose model…");
      detectors.pose = await vision.PoseLandmarker.createFromOptions(fileset, {
        ...common,
        baseOptions: { modelAssetPath: `${MODELS_BASE}/pose_landmarker_lite.task`, delegate },
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
      });
    }
    return detectors;
  }

  /** Runs the loaded landmarkers on the current video frame. */
  detect(video: HTMLVideoElement, timestampMs: number, mirrored: boolean): Landmarks {
    const width = video.videoWidth;
    const height = video.videoHeight;
    // MediaPipe requires strictly increasing timestamps per task.
    const ts = timestampMs <= this.lastTimestamp ? this.lastTimestamp + 1 : timestampMs;
    this.lastTimestamp = ts;
    const out: Landmarks = {
      image_width: width,
      image_height: height,
      face: null,
      hands: [],
      pose: null,
      pose_visibility: null,
    };
    if (this.face) {
      const result = this.face.detectForVideo(video, ts);
      const face = result.faceLandmarks[0];
      if (face) {
        out.face = toPoints(face, width, height, mirrored);
        out.face_score = 1;
      }
    }
    if (this.hands) {
      const result = this.hands.detectForVideo(video, ts);
      out.hands = result.landmarks.map((pts, i): Hand => {
        const category = result.handedness[i]?.[0];
        // MediaPipe labels handedness assuming a mirrored (selfie) input. For an unmirrored
        // rear-camera frame the label is swapped to keep "left/right" slots meaningful.
        let label = category?.categoryName ?? "Right";
        if (!mirrored) label = label === "Left" ? "Right" : "Left";
        return {
          points: toPoints(pts, width, height, mirrored),
          handedness: label,
          score: category?.score ?? 0.5,
        };
      });
    }
    if (this.pose) {
      const result = this.pose.detectForVideo(video, ts);
      const pose = result.landmarks[0];
      if (pose) {
        out.pose = toPoints(pose, width, height, mirrored);
        out.pose_visibility = pose.map((p) => p.visibility ?? 1);
      }
    }
    return out;
  }

  close(): void {
    this.face?.close();
    this.hands?.close();
    this.pose?.close();
    this.face = null;
    this.hands = null;
    this.pose = null;
  }
}

/** Feature detection for the live mode prerequisites. */
export function liveSupport(): { ok: true } | { ok: false; reason: "camera" | "webgl" | "wasm" } {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia)
    return { ok: false, reason: "camera" };
  if (typeof WebAssembly === "undefined") return { ok: false, reason: "wasm" };
  try {
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2") && !canvas.getContext("webgl"))
      return { ok: false, reason: "webgl" };
  } catch {
    return { ok: false, reason: "webgl" };
  }
  return { ok: true };
}
