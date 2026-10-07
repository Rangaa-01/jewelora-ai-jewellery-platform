"""Deterministic detector for tests: replays landmarks captured from the real detector."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from jewelora_ai.datatypes import Hand, Landmarks, Point


def landmarks_to_json(lm: Landmarks) -> dict[str, Any]:
    return {
        "image_width": lm.image_width,
        "image_height": lm.image_height,
        "face": [[p.x, p.y] for p in lm.face] if lm.face else None,
        "face_score": lm.face_score,
        "hands": [
            {"handedness": h.handedness, "score": h.score, "points": [[p.x, p.y] for p in h.points]}
            for h in lm.hands
        ],
        "pose": [[p.x, p.y] for p in lm.pose] if lm.pose else None,
        "pose_visibility": lm.pose_visibility,
    }


def landmarks_from_json(data: dict[str, Any]) -> Landmarks:
    lm = Landmarks(image_width=int(data["image_width"]), image_height=int(data["image_height"]))
    if data.get("face"):
        lm.face = [Point(float(x), float(y)) for x, y in data["face"]]
        lm.face_score = float(data.get("face_score", 1.0))
    for h in data.get("hands", []):
        lm.hands.append(
            Hand(
                points=[Point(float(x), float(y)) for x, y in h["points"]],
                handedness=h["handedness"],
                score=float(h["score"]),
            )
        )
    if data.get("pose"):
        lm.pose = [Point(float(x), float(y)) for x, y in data["pose"]]
        lm.pose_visibility = data.get("pose_visibility")
    return lm


class FixtureLandmarkDetector:
    def __init__(self, landmarks: Landmarks) -> None:
        self._landmarks = landmarks

    @classmethod
    def from_file(cls, path: Path) -> FixtureLandmarkDetector:
        return cls(landmarks_from_json(json.loads(path.read_text())))

    def detect(self, image_rgb: np.ndarray) -> Landmarks:
        return self._landmarks


class NullLandmarkDetector:
    """Detects nothing; used to exercise the no-detection error paths."""

    def detect(self, image_rgb: np.ndarray) -> Landmarks:
        h, w = image_rgb.shape[:2]
        return Landmarks(image_width=w, image_height=h)
