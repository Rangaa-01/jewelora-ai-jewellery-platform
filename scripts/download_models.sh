#!/usr/bin/env bash
# Downloads the MediaPipe model files used by the AI try-on engine into ai/models/.
# Safe to re-run: existing files with the expected size are skipped.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${AI_MODELS_DIR:-$ROOT/ai/models}"
BASE="https://storage.googleapis.com/mediapipe-models"
mkdir -p "$DEST"

download() {
  local name="$1"
  local url="$2"
  local target="$DEST/$name"
  if [[ -s "$target" ]]; then
    echo "✓ $name (cached)"
    return
  fi
  echo "↓ $name"
  curl -fsSL --retry 3 -o "$target.part" "$url"
  mv "$target.part" "$target"
}

download face_landmarker.task        "$BASE/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
download hand_landmarker.task        "$BASE/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
download pose_landmarker_lite.task   "$BASE/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
download selfie_multiclass_256x256.tflite "$BASE/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
download mobilenet_v3_small.tflite   "$BASE/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite"
# U²-Net salient object model used for automatic jewellery cut-outs (rembg), ~170 MB.
download u2net.onnx                  "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"

echo "Models ready in $DEST"
