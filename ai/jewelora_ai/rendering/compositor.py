"""Affine warp + lighting match + occlusion + contact shadow compositing.

This renderer is deterministic and fast (no learned model). It is good enough to give a
convincing impression of placement, scale and colour. A generative refinement stage can
be added as another ``Renderer`` (see README.md in this folder).
"""

from __future__ import annotations

import cv2
import numpy as np

from jewelora_ai.datatypes import Placement, SegmentationMasks, TryOnItem
from jewelora_ai.fitting.strand import chord_clip_row

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


def _warp_strips(asset: np.ndarray, placement: Placement, size: tuple[int, int]) -> np.ndarray:
    """Strand warp: draw each vertical strip with its own affine, blending overlaps softly."""
    w, h = size
    acc_rgb = np.zeros((h, w, 3), dtype=np.float32)
    acc_a = np.zeros((h, w), dtype=np.float32)
    overlap = 2  # px of overlap to hide seams between strips
    for x0, x1, matrix in placement.strips:
        xa, xb = max(0, x0 - overlap), min(asset.shape[1], x1 + overlap)
        if xb <= xa:
            continue
        piece = np.zeros_like(asset)
        piece[:, xa:xb] = asset[:, xa:xb]
        warped = _warp(piece, matrix, size).astype(np.float32) / 255.0
        a = warped[..., 3]
        # "over" accumulation keeps colour correct where strips overlap
        acc_rgb = acc_rgb * (1 - a[..., None]) + warped[..., :3] * a[..., None]
        acc_a = acc_a + a * (1 - acc_a)
    out = np.zeros((h, w, 4), dtype=np.float32)
    out[..., :3] = acc_rgb
    out[..., 3] = acc_a
    return out


def clip_above_chord(rgba: np.ndarray, chord_y: np.ndarray) -> np.ndarray:
    """Make pixels above the top-end chord transparent (the back half of a looped necklace)."""
    h = rgba.shape[0]
    rows = np.arange(h, dtype=np.float64)[:, None]
    keep = rows >= chord_y[None, :]
    out = rgba.copy()
    out[..., 3] = np.where(keep, out[..., 3], 0)
    return out


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


QUALITY_LEVELS = ("fast", "standard", "premium")


class AffineCompositor:
    """Warp → defringe → relight → focus/grain match → occlusion → body shadow → composite.

    ``quality``:
    * ``fast``: geometry, occlusion, brightness and a simple shadow (quick previews).
    * ``standard``: full photographic integration (white balance, light direction, focus
      and grain matching, shadows that only land on the body, necklace ends that wrap).
    * ``premium``: as standard, rendered on the full-resolution photo by the service.
    """

    def __init__(self, *, shadow_opacity: float = 0.32, match_lighting: bool = True) -> None:
        self.shadow_opacity = shadow_opacity
        self.match_lighting = match_lighting

    def render(
        self,
        image_rgb: np.ndarray,
        items: list[tuple[TryOnItem, Placement]],
        masks: SegmentationMasks | None,
        quality: str = "standard",
    ) -> np.ndarray:
        return self.render_layers(image_rgb, items, masks, quality)[0]

    def render_layers(
        self,
        image_rgb: np.ndarray,
        items: list[tuple[TryOnItem, Placement]],
        masks: SegmentationMasks | None,
        quality: str = "standard",
    ) -> tuple[np.ndarray, np.ndarray]:
        """The composite plus the jewellery coverage (0..1) used by refinement guards."""
        from jewelora_ai.rendering import realism

        h, w = image_rgb.shape[:2]
        out = image_rgb.astype(np.float32) / 255.0
        coverage = np.zeros((h, w), dtype=np.float32)
        full = quality != "fast"
        light = realism.analyse_scene(image_rgb, masks) if full and self.match_lighting else None
        receiver = realism.receiver_mask(masks, (h, w)) if full else None
        for index, (item, placement) in enumerate(items):
            rgba = item.asset.image
            if item.tint_hex:
                rgba = tint_metal(rgba, item.tint_hex)
            if full:
                rgba = realism.defringe(rgba)
            if placement.strips:
                rgba = clip_above_chord(rgba, chord_clip_row(item.asset))
                if full and {"left_end", "right_end"} <= set(item.asset.anchors):
                    left = item.asset.anchor_px("left_end")
                    right = item.asset.anchor_px("right_end")
                    rgba = realism.wrap_strand_ends(rgba, left.x, right.x, min(left.y, right.y))
                warped = _warp_strips(rgba, placement, (w, h))
            else:
                warped = _warp(rgba, placement.matrix, (w, h)).astype(np.float32) / 255.0
            colour, alpha = warped[..., :3], warped[..., 3]
            if alpha.max() <= 0:
                continue
            scale = float(np.hypot(placement.matrix[0, 0], placement.matrix[1, 0]))
            if light is not None:
                colour = realism.relight(colour, alpha, light, placement.bbox)
                scene_sharp = realism.local_sharpness(image_rgb, placement.bbox)
                # The piece's sharpness after scaling: downscaling sharpens, upscaling softens.
                piece_sharp = realism.asset_sharpness(rgba) * min(1.0 / max(scale, 1e-3), 4.0)
                colour, alpha = realism.match_focus(colour, alpha, scene_sharp, piece_sharp)
                colour = realism.add_grain(colour, alpha, light.noise_sigma, seed=17 + index)
            elif self.match_lighting:
                lum = _region_luminance(image_rgb, placement.bbox, alpha)
                gain = float(np.clip(lum / 0.5, 0.72, 1.18))
                colour = np.clip(colour * gain, 0, 1)
            # occlusion by segmentation masks (hair in front of earrings and necklaces)
            if masks is not None:
                for name, strength in placement.occlusion.items():
                    mask = getattr(masks, name, None)
                    if mask is not None:
                        alpha = alpha * (1.0 - np.clip(mask, 0, 1) * strength)
            # shadow on the body
            if light is not None:
                shadow = realism.body_shadow(alpha, light, scale, receiver, self.shadow_opacity)
            else:
                offset = max(1, round(2.5 * max(scale, 0.4)))
                blur = max(1.0, 3.0 * max(scale, 0.4))
                shadow = np.zeros_like(alpha)
                shadow[offset:, offset // 2 :] = alpha[:-offset, : -(offset // 2) or None]
                shadow = cv2.GaussianBlur(shadow, (0, 0), blur) * self.shadow_opacity
            out = out * (1.0 - shadow[..., None]) + out * 0.35 * shadow[..., None]
            a = alpha[..., None]
            out = out * (1.0 - a) + colour * a
            coverage = np.maximum(coverage, alpha)
        return np.asarray(np.clip(out * 255.0 + 0.5, 0, 255), dtype=np.uint8), coverage
