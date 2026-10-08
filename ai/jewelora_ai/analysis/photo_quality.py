"""Customer photo checks: is this photo good enough for the pieces they chose?

Runs on the detection the engine already made (no extra model). Every finding carries a
friendly, actionable message; nothing here blocks a try-on — a soft photo still gets a
result, with advice on how to get a better one.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import cv2
import numpy as np

from jewelora_ai.datatypes import JewelleryType, Landmarks

FACE_TYPES = {
    JewelleryType.NECKLACE,
    JewelleryType.CHAIN,
    JewelleryType.PENDANT,
    JewelleryType.HARAM,
    JewelleryType.CHOKER,
    JewelleryType.EARRINGS,
    JewelleryType.NOSE_RING,
    JewelleryType.MAANG_TIKKA,
}
NECK_TYPES = {
    JewelleryType.NECKLACE,
    JewelleryType.CHAIN,
    JewelleryType.PENDANT,
    JewelleryType.HARAM,
    JewelleryType.CHOKER,
}
HAND_TYPES = {JewelleryType.RING, JewelleryType.BANGLE, JewelleryType.BRACELET}


@dataclass(frozen=True)
class PhotoFinding:
    code: str
    severity: str  # "tip" (result is fine, could be better) | "warning" (result may be off)
    message: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


def _region(image: np.ndarray, points: list[tuple[float, float]], pad: float) -> np.ndarray:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)
    x0 = int(max(0, min(xs) - w * pad))
    y0 = int(max(0, min(ys) - h * pad))
    x1 = int(min(image.shape[1], max(xs) + w * pad))
    y1 = int(min(image.shape[0], max(ys) + h * pad))
    return image[y0:y1, x0:x1]


def analyse_photo(
    image_rgb: np.ndarray, landmarks: Landmarks, types: set[JewelleryType]
) -> list[PhotoFinding]:
    findings: list[PhotoFinding] = []
    h, w = image_rgb.shape[:2]
    if min(h, w) < 480:
        findings.append(
            PhotoFinding(
                "low_resolution",
                "tip",
                "This photo is quite small. A larger photo gives a crisper, more detailed result.",
            )
        )
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    needs_face = bool(types & FACE_TYPES)
    face = landmarks.face
    subject = gray
    if face is not None:
        subject = _region(gray[..., None], [(p.x, p.y) for p in face], 0.1)[..., 0]
        face_w = face[454].x - face[234].x
        if needs_face and face_w < w * 0.08:
            findings.append(
                PhotoFinding(
                    "subject_far",
                    "tip",
                    "Move a little closer: your face fills only a small part of the photo.",
                )
            )
        nose = face[1]
        left, right = face[234], face[454]
        yaw = abs(((nose.x - left.x) / ((right.x - left.x) or 1.0) - 0.5) * 2)
        if JewelleryType.EARRINGS in types and yaw > 0.7:
            findings.append(
                PhotoFinding(
                    "head_turned",
                    "tip",
                    "Your head is turned well to the side, so only one earring shows. Face the "
                    "camera to see both.",
                )
            )
    if subject.size >= 64:
        sharp = float(cv2.Laplacian(subject.astype(np.float32) / 255.0, cv2.CV_32F).var())
        if sharp < 0.0008:
            findings.append(
                PhotoFinding(
                    "blurry",
                    "tip",
                    "The photo looks a little soft. Hold the camera steady or tap to focus.",
                )
            )
        mean = float(subject.mean()) / 255.0
        if mean < 0.22:
            findings.append(
                PhotoFinding(
                    "too_dark",
                    "tip",
                    "The photo is quite dark. Face a window or a lamp for truer metal colours.",
                )
            )
        elif mean > 0.85:
            findings.append(
                PhotoFinding(
                    "too_bright",
                    "tip",
                    "The photo is very bright. Step out of direct light to keep the details.",
                )
            )
    if types & NECK_TYPES and face is not None:
        chin = face[152]
        face_h = chin.y - face[10].y
        if chin.y + face_h * 0.5 > h:
            findings.append(
                PhotoFinding(
                    "neckline_cropped",
                    "warning",
                    "We couldn't see much of your neckline. Try a slightly wider photo that shows "
                    "your shoulders.",
                )
            )
    if types & HAND_TYPES and landmarks.hands:
        hand = landmarks.hands[0]
        xs = [p.x for p in hand.points]
        if max(xs) - min(xs) < w * 0.12:
            findings.append(
                PhotoFinding(
                    "hand_far",
                    "tip",
                    "Bring your hand a little closer to the camera for a better fit.",
                )
            )
    return findings
