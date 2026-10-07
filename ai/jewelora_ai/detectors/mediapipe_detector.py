"""MediaPipe Tasks based landmark detection (face, hands, pose)."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import numpy as np

from jewelora_ai.datatypes import Hand, Landmarks, Point
from jewelora_ai.models import model_path


class MediaPipeLandmarkDetector:
    """Runs the three landmarkers. Instances are thread-safe (a lock serialises inference)."""

    def __init__(self, models_dir: Path | None = None, *, max_hands: int = 2) -> None:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        self._mp = mp
        self._vision = vision
        base = mp_python.BaseOptions
        self._face = vision.FaceLandmarker.create_from_options(
            vision.FaceLandmarkerOptions(
                base_options=base(model_asset_path=str(model_path("face", models_dir))),
                num_faces=1,
                output_facial_transformation_matrixes=True,
                min_face_detection_confidence=0.4,
            )
        )
        self._hand = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=base(model_asset_path=str(model_path("hand", models_dir))),
                num_hands=max_hands,
                min_hand_detection_confidence=0.4,
            )
        )
        self._pose = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=base(model_asset_path=str(model_path("pose", models_dir))),
                num_poses=1,
                min_pose_detection_confidence=0.4,
            )
        )
        self._lock = threading.Lock()

    def _image(self, rgb: np.ndarray) -> Any:
        return self._mp.Image(
            image_format=self._mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)
        )

    def detect(self, image_rgb: np.ndarray) -> Landmarks:
        h, w = image_rgb.shape[:2]
        out = Landmarks(image_width=w, image_height=h)
        with self._lock:
            mp_img = self._image(image_rgb)
            face = self._face.detect(mp_img)
            hands = self._hand.detect(mp_img)
            pose = self._pose.detect(mp_img)
        if face.face_landmarks:
            pts = face.face_landmarks[0]
            out.face = [Point(p.x * w, p.y * h) for p in pts]
            out.face_score = 1.0
            if face.facial_transformation_matrixes:
                out.face_transform = np.asarray(
                    face.facial_transformation_matrixes[0], dtype=np.float32
                )
        for idx, pts in enumerate(hands.hand_landmarks):
            handedness = hands.handedness[idx][0]
            world = None
            if hands.hand_world_landmarks:
                world = [(p.x, p.y, p.z) for p in hands.hand_world_landmarks[idx]]
            out.hands.append(
                Hand(
                    points=[Point(p.x * w, p.y * h) for p in pts],
                    handedness=str(handedness.category_name),
                    score=float(handedness.score),
                    world_points=world,
                )
            )
        if pose.pose_landmarks:
            pts = pose.pose_landmarks[0]
            out.pose = [Point(p.x * w, p.y * h) for p in pts]
            out.pose_visibility = [float(getattr(p, "visibility", 1.0) or 0.0) for p in pts]
        return out

    def close(self) -> None:
        for task in (self._face, self._hand, self._pose):
            task.close()
