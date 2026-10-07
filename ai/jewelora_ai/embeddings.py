"""Image embeddings for visual search (MediaPipe ImageEmbedder, MobileNet V3)."""

from __future__ import annotations

import threading
from pathlib import Path

import numpy as np

from jewelora_ai.models import model_path

EMBEDDING_MODEL_NAME = "mobilenet_v3_small"


class MediaPipeImageEmbedder:
    def __init__(self, models_dir: Path | None = None) -> None:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        self._mp = mp
        self._embedder = vision.ImageEmbedder.create_from_options(
            vision.ImageEmbedderOptions(
                base_options=mp_python.BaseOptions(
                    model_asset_path=str(model_path("embedder", models_dir))
                ),
                l2_normalize=True,
                quantize=False,
            )
        )
        self._lock = threading.Lock()

    def embed(self, image_rgb: np.ndarray) -> np.ndarray:
        with self._lock:
            result = self._embedder.embed(
                self._mp.Image(
                    image_format=self._mp.ImageFormat.SRGB, data=np.ascontiguousarray(image_rgb)
                )
            )
        vector = np.asarray(result.embeddings[0].embedding, dtype=np.float32)
        norm = np.linalg.norm(vector) or 1.0
        return vector / norm

    def close(self) -> None:
        self._embedder.close()


def cosine_similarity(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Similarity of one L2-normalised query against rows of a normalised matrix."""
    if matrix.size == 0:
        return np.zeros(0, dtype=np.float32)
    return np.asarray(matrix @ query, dtype=np.float32)
