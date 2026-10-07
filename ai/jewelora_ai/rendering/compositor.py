"""Affine warp + lighting match + occlusion + contact shadow compositing.

This renderer is deterministic and fast (no learned model). It is good enough to give a
convincing impression of placement, scale and colour. A generative refinement stage can
be added as another ``Renderer`` (see README.md in this folder).
"""

from __future__ import annotations

import cv2
import numpy as np

from jewelora_ai.datatypes import Placement, SegmentationMasks, TryOnItem

MASK_NAMES = ("hair", "body_skin", "face_skin", "clothes", "background")


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def tint_metal(rgba: np.ndarray, tint_hex: str, *, reference_hex: str = "#d6a84a") -> np.ndarray:
    """Recolour the metallic parts of an asset towards ``tint_hex``.

    Pixels whose hue is close to the reference metal hue are re-mapped in HSV space, keeping
    value/saturation structure (highlights and shading) so the material still reads as metal.
    Gems and pearls (different hues / low saturation) are left untouched.
    """
    target = np.array(hex_to_rgb(tint_hex), dtype=np.float32)
    ref = np.array(hex_to_rgb(reference_hex), dtype=np.float32)
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3:4]
    hsv = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    ref_hsv = cv2.cvtColor(ref.reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV)[0, 0].astype(
        np.float32
    )
    tgt_hsv = cv2.cvtColor(target.reshape(1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV)[
        0, 0
    ].astype(np.float32)
    hue_diff = np.abs(hsv[..., 0] - ref_hsv[0])
    hue_diff = np.minimum(hue_diff, 180 - hue_diff)
    metal_mask = (hue_diff < 14) & (hsv[..., 1] > 40)
    weight = metal_mask.astype(np.float32)
    weight = cv2.GaussianBlur(weight, (0, 0), 1.0)
    hsv[..., 0] = np.where(weight > 0.05, tgt_hsv[0], hsv[..., 0])
    sat_ratio = (tgt_hsv[1] + 1) / (ref_hsv[1] + 1)
    val_ratio = (tgt_hsv[2] + 1) / (ref_hsv[2] + 1)
    hsv[..., 1] = np.clip(hsv[..., 1] * (1 - weight) + hsv[..., 1] * sat_ratio * weight, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * (1 - weight) + hsv[..., 2] * val_ratio * weight, 0, 255)
    out_rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return np.concatenate([out_rgb, alpha], axis=-1).astype(np.uint8)


def _warp(asset: np.ndarray, matrix: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    w, h = size
    return cv2.warpAffine(
        asset,
        matrix.astype(np.float32),
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )


def _region_luminance(
    image: np.ndarray, bbox: tuple[int, int, int, int], alpha: np.ndarray
) -> float:
    x0, y0, x1, y1 = bbox
    if x1 <= x0 or y1 <= y0:
        return 0.55
    pad_x, pad_y = int((x1 - x0) * 0.25) + 4, int((y1 - y0) * 0.25) + 4
    xs, ys = max(0, x0 - pad_x), max(0, y0 - pad_y)
    xe, ye = min(image.shape[1], x1 + pad_x), min(image.shape[0], y1 + pad_y)
    region = image[ys:ye, xs:xe].astype(np.float32) / 255.0
    if region.size == 0:
        return 0.55
    lum = 0.2126 * region[..., 0] + 0.7152 * region[..., 1] + 0.0722 * region[..., 2]
    # Prefer pixels around (not under) the jewellery.
    a = alpha[ys:ye, xs:xe]
    weight = np.clip(1.0 - a, 0.0, 1.0)
    if weight.sum() < 1:
        return float(lum.mean())
    return float((lum * weight).sum() / weight.sum())


class AffineCompositor:
    def __init__(self, *, shadow_opacity: float = 0.32, match_lighting: bool = True) -> None:
        self.shadow_opacity = shadow_opacity
        self.match_lighting = match_lighting

    def render(
        self,
        image_rgb: np.ndarray,
        items: list[tuple[TryOnItem, Placement]],
        masks: SegmentationMasks | None,
    ) -> np.ndarray:
        h, w = image_rgb.shape[:2]
        out = image_rgb.astype(np.float32) / 255.0
        for item, placement in items:
            rgba = item.asset.image
            if item.tint_hex:
                rgba = tint_metal(rgba, item.tint_hex)
            warped = _warp(rgba, placement.matrix, (w, h)).astype(np.float32) / 255.0
            colour, alpha = warped[..., :3], warped[..., 3]
            if alpha.max() <= 0:
                continue
            # occlusion by segmentation masks (hair in front of earrings etc.)
            if masks is not None:
                for name, strength in placement.occlusion.items():
                    mask = getattr(masks, name, None)
                    if mask is not None:
                        alpha = alpha * (1.0 - np.clip(mask, 0, 1) * strength)
            # lighting match: scale asset brightness towards the local scene luminance
            if self.match_lighting:
                lum = _region_luminance(image_rgb, placement.bbox, alpha)
                gain = float(np.clip(lum / 0.5, 0.72, 1.18))
                colour = np.clip(colour * gain, 0, 1)
                # subtle colour cast from the surroundings
                x0, y0, x1, y1 = placement.bbox
                if x1 > x0 and y1 > y0:
                    cast = out[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)
                    cast = cast / (cast.mean() + 1e-6)
                    colour = np.clip(colour * (0.92 + 0.08 * cast), 0, 1)
            # contact shadow
            scale = float(np.hypot(placement.matrix[0, 0], placement.matrix[1, 0]))
            offset = max(1, round(2.5 * max(scale, 0.4)))
            blur = max(1.0, 3.0 * max(scale, 0.4))
            shadow = np.zeros_like(alpha)
            shadow[offset:, offset // 2 :] = alpha[:-offset, : -(offset // 2) or None]
            shadow = cv2.GaussianBlur(shadow, (0, 0), blur) * self.shadow_opacity
            out = out * (1.0 - shadow[..., None]) + out * 0.35 * shadow[..., None]
            # composite
            a = alpha[..., None]
            out = out * (1.0 - a) + colour * a
        return np.asarray(np.clip(out * 255.0 + 0.5, 0, 255), dtype=np.uint8)
