"""MediaPipe selfie multiclass segmentation → soft occlusion masks."""

from __future__ import annotations

import threading
from pathlib import Path

import cv2
import numpy as np

from jewelora_ai.datatypes import SegmentationMasks
from jewelora_ai.models import model_path

# selfie_multiclass_256x256 categories: background, hair, body-skin, face-skin, clothes, others
_CATEGORIES = ("background", "hair", "body_skin", "face_skin", "clothes")


class MediaPipeSegmenter:
    def __init__(self, models_dir: Path | None = None) -> None:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        self._mp = mp
        self._segmenter = vision.ImageSegmenter.create_from_options(
            vision.ImageSegmenterOptions(
                base_options=mp_python.BaseOptions(
                    model_asset_path=str(model_path("segmenter", models_dir))
                ),
                output_confidence_masks=True,
                output_category_mask=False,
            )
        )
        self._lock = threading.Lock()

    def segment(self, image_rgb: np.ndarray) -> SegmentationMasks:
        h, w = image_rgb.shape[:2]
        with self._lock:
            result = self._segmenter.segment(
                self._mp.Image(
                    image_format=self._mp.ImageFormat.SRGB, data=np.ascontiguousarray(image_rgb)
                )
            )
        masks = SegmentationMasks()
        for idx, name in enumerate(_CATEGORIES):
            if idx >= len(result.confidence_masks):
                break
            conf = result.confidence_masks[idx].numpy_view().astype(np.float32)
            if conf.shape[0] != h or conf.shape[1] != w:
                conf = cv2.resize(conf, (w, h), interpolation=cv2.INTER_LINEAR)
            conf = cv2.GaussianBlur(conf, (0, 0), sigmaX=max(1.0, w / 400))
            setattr(masks, name, np.clip(conf, 0.0, 1.0))
        return masks

    def close(self) -> None:
        self._segmenter.close()


class NullSegmenter:
    def segment(self, image_rgb: np.ndarray) -> SegmentationMasks:
        return SegmentationMasks()
