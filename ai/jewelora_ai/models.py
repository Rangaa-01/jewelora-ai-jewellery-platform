"""Resolve MediaPipe model files."""

from __future__ import annotations

import os
from pathlib import Path

DEFAULT_MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

MODEL_FILES = {
    "face": "face_landmarker.task",
    "hand": "hand_landmarker.task",
    "pose": "pose_landmarker_lite.task",
    "segmenter": "selfie_multiclass_256x256.tflite",
    "embedder": "mobilenet_v3_small.tflite",
}


class ModelsMissingError(RuntimeError):
    pass


def models_dir() -> Path:
    return Path(os.environ.get("AI_MODELS_DIR", str(DEFAULT_MODELS_DIR)))


def model_path(name: str, base: Path | None = None) -> Path:
    path = (base or models_dir()) / MODEL_FILES[name]
    if not path.is_file():
        raise ModelsMissingError(
            f"MediaPipe model '{MODEL_FILES[name]}' not found in {path.parent}. "
            "Run scripts/download_models.sh (or `make models`)."
        )
    return path


def models_available(base: Path | None = None) -> bool:
    base = base or models_dir()
    return all((base / f).is_file() for f in MODEL_FILES.values())
