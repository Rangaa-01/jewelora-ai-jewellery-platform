"""Photographic integration: make a cut-out look like it was photographed with the customer.

A product cut-out is shot in a studio: neutral white balance, crisp focus, no sensor noise,
light from the photographer's softboxes. The customer's photo is the opposite on every
count. These functions measure the customer's photo and degrade/relight the jewellery to
match, which is what removes the "pasted sticker" look:

* white balance and exposure  → ``SceneLight.gain`` (from skin, a reliable neutral-ish reference)
* light direction             → ``SceneLight.direction`` (shading gradient across the face)
* softness / depth of field   → ``local_sharpness`` vs the asset's own sharpness
* sensor noise                → ``estimate_noise_sigma`` (Immerkær's fast noise estimator)
* edge fringe from the studio backdrop → ``defringe``
* contact with the body       → ``body_shadow`` (cast away from the light, on skin/clothes only)

All of it is deterministic, CPU-only and changes only the jewellery pixels and the soft
shadow they cast; the customer's face, skin and hair are never altered.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from jewelora_ai.datatypes import SegmentationMasks

# Reference skin chromaticity (r, g, b normalised to sum 1) under neutral daylight,
# averaged over a wide range of skin tones; tones differ mostly in brightness, not ratio.
_NEUTRAL_SKIN_CHROMA = np.array([0.42, 0.33, 0.25], dtype=np.float32)


@dataclass(frozen=True)
class SceneLight:
    gain: np.ndarray  # per-channel multiplier (3,) applying the scene's colour cast
    exposure: float  # mean luminance of the subject, 0..1
    direction: tuple[float, float]  # unit vector pointing *towards* the light (image coords)
    strength: float  # 0 (flat light) .. 1 (hard directional light)
    noise_sigma: float  # sensor noise, in 0..1 units
    softness: float  # 0 (hard shadows) .. 1 (very soft light)


def _luma(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def estimate_noise_sigma(image_rgb: np.ndarray) -> float:
    """Immerkær (1996) fast noise variance estimation on the luma channel, 0..1 units."""
    gray = _luma(image_rgb.astype(np.float32) / 255.0)
    if gray.shape[0] < 8 or gray.shape[1] < 8:
        return 0.0
    kernel = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], dtype=np.float32)
    conv = cv2.filter2D(gray, -1, kernel)[1:-1, 1:-1]
    h, w = conv.shape
    sigma = float(np.sum(np.abs(conv)) * np.sqrt(0.5 * np.pi) / (6.0 * w * h))
    return float(np.clip(sigma, 0.0, 0.08))


def local_sharpness(image_rgb: np.ndarray, bbox: tuple[int, int, int, int]) -> float:
    """Variance of the Laplacian around a region (higher = crisper)."""
    x0, y0, x1, y1 = bbox
    pad = max(8, int(max(x1 - x0, y1 - y0) * 0.3))
    xs, ys = max(0, x0 - pad), max(0, y0 - pad)
    xe, ye = min(image_rgb.shape[1], x1 + pad), min(image_rgb.shape[0], y1 + pad)
    region = image_rgb[ys:ye, xs:xe]
    if region.size == 0 or min(region.shape[:2]) < 8:
        return 0.0
    gray = cv2.cvtColor(region, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    return float(cv2.Laplacian(gray, cv2.CV_32F).var())


def _skin_mask(masks: SegmentationMasks | None, shape: tuple[int, int]) -> np.ndarray | None:
    if masks is None:
        return None
    parts = [m for m in (masks.face_skin, masks.body_skin) if m is not None]
    if not parts:
        return None
    skin = np.maximum.reduce(parts) if len(parts) > 1 else parts[0]
    if skin.shape != shape:
        return None
    return skin


def analyse_scene(image_rgb: np.ndarray, masks: SegmentationMasks | None) -> SceneLight:
    """Measure the light the customer was photographed in."""
    rgb = image_rgb.astype(np.float32) / 255.0
    h, w = rgb.shape[:2]
    skin = _skin_mask(masks, (h, w))
    weight = (skin > 0.6).astype(np.float32) if skin is not None else None
    if weight is None or weight.sum() < 200:
        # No skin found: use the whole frame (grey-world), less reliable so damped below.
        weight = np.ones((h, w), dtype=np.float32)
        reliable = False
    else:
        reliable = True
    total = float(weight.sum())
    mean = (rgb * weight[..., None]).reshape(-1, 3).sum(axis=0) / max(total, 1.0)
    exposure = float(_luma(mean[None, None, :])[0, 0])
    chroma = mean / max(float(mean.sum()), 1e-6)
    reference = _NEUTRAL_SKIN_CHROMA if reliable else np.full(3, 1 / 3, dtype=np.float32)
    cast = chroma / reference
    cast = cast / float(cast.mean())
    # Damp: a full correction over-tints; jewellery reflects only part of the ambient colour.
    damping = 0.35 if reliable else 0.2
    gain = 1.0 + (cast - 1.0) * damping
    gain = np.clip(gain, 0.9, 1.1)
    # Colour cast only: keep the piece's luminance (exposure is handled separately).
    gain = gain / float(0.2126 * gain[0] + 0.7152 * gain[1] + 0.0722 * gain[2])
    gain = gain.astype(np.float32)

    # Light direction from the luminance gradient across lit skin.
    direction = (0.0, -1.0)
    strength = 0.0
    if reliable:
        lum = _luma(rgb)
        ys, xs = np.nonzero(weight > 0)
        if len(xs) > 400:
            values = lum[ys, xs]
            cx, cy = xs.mean(), ys.mean()
            dx, dy = xs - cx, ys - cy
            # Least squares plane fit lum ≈ a·dx + b·dy + c over the skin.
            design = np.stack([dx, dy, np.ones_like(dx)], axis=1).astype(np.float64)
            coef, *_ = np.linalg.lstsq(design, values.astype(np.float64), rcond=None)
            gx, gy = float(coef[0]), float(coef[1])
            span = float(max(int(xs.max() - xs.min()), int(ys.max() - ys.min()), 1))
            magnitude = float(np.hypot(gx, gy)) * span
            if magnitude > 1e-4:
                direction = (gx / np.hypot(gx, gy), gy / np.hypot(gx, gy))
            strength = float(np.clip(magnitude / 0.35, 0.0, 1.0))
    softness = float(np.clip(1.0 - strength, 0.15, 1.0))
    return SceneLight(
        gain=gain,
        exposure=exposure,
        direction=direction,
        strength=strength,
        noise_sigma=estimate_noise_sigma(image_rgb),
        softness=softness,
    )


def defringe(rgba: np.ndarray, radius: int = 2) -> np.ndarray:
    """Replace the colour of semi-transparent edge pixels with nearby solid colour, so the
    studio backdrop (white, black, fabric) doesn't show as a halo around the piece."""
    if rgba.shape[0] < 4 or rgba.shape[1] < 4:
        return rgba
    alpha = rgba[..., 3].astype(np.float32) / 255.0
    solid = (alpha > 0.95).astype(np.float32)
    if solid.sum() == 0:
        return rgba
    k = 2 * radius + 1
    colour = rgba[..., :3].astype(np.float32)
    summed = cv2.blur(colour * solid[..., None], (k, k))
    count = cv2.blur(solid, (k, k))
    fill = summed / np.maximum(count[..., None], 1e-6)
    edge = ((alpha > 0.0) & (alpha < 0.95) & (count > 0.0))[..., None]
    out = rgba.copy()
    out[..., :3] = np.where(edge, np.clip(fill, 0, 255), colour).astype(np.uint8)
    return out


def relight(
    colour: np.ndarray, alpha: np.ndarray, light: SceneLight, bbox: tuple[int, int, int, int]
) -> np.ndarray:
    """Apply the scene's colour cast, exposure and a soft directional falloff across the
    piece. Highlights (near-white specular glints) keep their brightness so metal still
    sparkles; only their tint follows the scene."""
    out = colour * light.gain[None, None, :]
    # Exposure: pull mid-tones towards the subject's exposure, never crush highlights.
    # Darker photos darken the piece; brighter ones never wash it out beyond the studio shot.
    target = float(np.clip(light.exposure / 0.55, 0.72, 1.0))
    lum = _luma(out)
    highlight = np.clip((lum - 0.8) / 0.2, 0.0, 1.0)[..., None]
    out = out * (target * (1 - highlight) + highlight)
    # Directional falloff: brighter on the side facing the light.
    x0, y0, x1, y1 = bbox
    if light.strength > 0.05 and x1 > x0 and y1 > y0:
        h, w = alpha.shape
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        half = max(x1 - x0, y1 - y0) / 2 or 1.0
        proj = ((xx - cx) * light.direction[0] + (yy - cy) * light.direction[1]) / half
        shade = 1.0 + np.clip(proj, -1.0, 1.0) * 0.14 * light.strength
        out = out * shade[..., None]
    return np.asarray(np.clip(out, 0.0, 1.0), dtype=np.float32)


def match_focus(
    colour: np.ndarray,
    alpha: np.ndarray,
    scene_sharpness: float,
    piece_sharpness: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Soften the piece when the photo around it is softer (focus, motion, phone processing)."""
    if piece_sharpness <= 0 or scene_sharpness <= 0:
        return colour, alpha
    ratio = scene_sharpness / piece_sharpness
    if ratio >= 0.6:
        return colour, alpha
    # Jewellery sits in the same focal plane as the skin, so it is never blurrier than a
    # soft photo; a small Gaussian takes the studio crispness off without losing detail.
    sigma = float(np.clip((0.6 - ratio) * 1.2, 0.25, 0.65))
    premult = colour * alpha[..., None]
    blurred = cv2.GaussianBlur(premult, (0, 0), sigma)
    a = cv2.GaussianBlur(alpha, (0, 0), sigma)
    col = blurred / np.maximum(a[..., None], 1e-4)
    # Keep thin chains as opaque as before: blur spreads coverage, it must not thin it out.
    a = np.clip(a * 1.15, 0.0, 1.0)
    return np.clip(col, 0.0, 1.0), np.maximum(a, alpha * 0.85)


def add_grain(colour: np.ndarray, alpha: np.ndarray, sigma: float, seed: int = 7) -> np.ndarray:
    """Give the piece the photo's sensor noise (deterministic per render)."""
    if sigma < 0.002:
        return colour
    rng = np.random.default_rng(seed)
    noise = rng.normal(0.0, sigma, size=alpha.shape).astype(np.float32)
    # Luma noise plus a little chroma noise, like a real sensor.
    chroma = rng.normal(0.0, sigma * 0.35, size=colour.shape).astype(np.float32)
    mask = (alpha > 0.01)[..., None]
    return np.asarray(
        np.clip(colour + (noise[..., None] + chroma) * mask, 0.0, 1.0), dtype=np.float32
    )


def body_shadow(
    alpha: np.ndarray,
    light: SceneLight,
    scale: float,
    receiver: np.ndarray | None,
    opacity: float,
) -> np.ndarray:
    """Soft shadow cast away from the light onto skin/clothes (not onto the background),
    plus a faint ambient-occlusion halo where the piece touches the body."""
    reach = max(1.0, 2.2 * max(scale, 0.4)) * (0.6 + 0.8 * light.strength)
    dx = -light.direction[0] * reach
    dy = max(-light.direction[1] * reach, reach * 0.5)  # gravity: pieces rest on the body
    shifted = cv2.warpAffine(
        alpha,
        np.array([[1, 0, dx], [0, 1, dy]], dtype=np.float32),
        (alpha.shape[1], alpha.shape[0]),
        borderValue=0,
    )
    blur = max(1.0, (1.5 + 3.5 * light.softness) * max(scale, 0.4))
    cast = cv2.GaussianBlur(shifted, (0, 0), blur) * opacity
    ambient = cv2.GaussianBlur(alpha, (0, 0), blur * 2.5) * (opacity * 0.35)
    shadow = np.maximum(cast, ambient)
    if receiver is not None:
        shadow = shadow * np.clip(receiver, 0.0, 1.0)
    return np.asarray(np.clip(shadow * (1.0 - alpha), 0.0, 1.0), dtype=np.float32)


def receiver_mask(masks: SegmentationMasks | None, shape: tuple[int, int]) -> np.ndarray | None:
    """Where a shadow can land: skin, clothes and hair (not the background)."""
    if masks is None:
        return None
    parts = [
        m
        for m in (masks.face_skin, masks.body_skin, masks.clothes, masks.hair)
        if m is not None and m.shape == shape
    ]
    if not parts:
        return None
    merged = np.maximum.reduce(parts) if len(parts) > 1 else parts[0]
    return np.asarray(np.clip(merged, 0.0, 1.0), dtype=np.float32)


def asset_sharpness(rgba: np.ndarray) -> float:
    """Laplacian variance of the opaque part of a cut-out."""
    alpha = rgba[..., 3]
    if alpha.max() == 0:
        return 0.0
    gray = (
        cv2.cvtColor(np.ascontiguousarray(rgba[..., :3]), cv2.COLOR_RGB2GRAY).astype(np.float32)
        / 255.0
    )
    lap = cv2.Laplacian(gray, cv2.CV_32F)
    inside = cv2.erode((alpha > 200).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    if inside.sum() < 50:
        return float(lap.var())
    return float(lap[inside].var())


def wrap_strand_ends(rgba: np.ndarray, left_x: float, right_x: float, top_y: float) -> np.ndarray:
    """Fade the top ends of a necklace so the chain appears to continue around the neck
    instead of stopping abruptly at the neck points."""
    h, w = rgba.shape[:2]
    span = max(right_x - left_x, 1.0)
    fade = span * 0.07
    xs = np.arange(w, dtype=np.float32)
    ramp_l = np.clip((xs - left_x) / fade, 0.0, 1.0)
    ramp_r = np.clip((right_x - xs) / fade, 0.0, 1.0)
    ramp = np.minimum(ramp_l, ramp_r)
    rows = np.arange(h, dtype=np.float32)[:, None]
    # Only the upper part of the piece wraps; pendants and drops stay fully visible.
    zone = np.clip((top_y + span * 0.22 - rows) / (span * 0.12), 0.0, 1.0)
    factor = 1.0 - zone * (1.0 - ramp[None, :])
    out = rgba.copy()
    out[..., 3] = (out[..., 3].astype(np.float32) * factor).astype(np.uint8)
    return out
