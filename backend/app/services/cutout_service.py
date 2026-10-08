"""Automatic try-on asset creation from ordinary product photography.

1. Background removal (U²-Net via ``rembg``, model file ``ai/models/u2net.onnx``) turns a
   studio photo into a transparent cut-out.
2. The alpha mask is trimmed and, for pairs (earrings), reduced to one piece.
3. Anchor points required by the fitting engine are estimated from the mask geometry per
   jewellery type. Staff can refine them in the admin anchor editor.

Everything runs on the server in a worker thread; the model loads lazily and once.
"""

from __future__ import annotations

import io
import os
import threading
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.core.errors import ServiceUnavailableError, UploadError
from app.core.settings import Settings

# Typical physical widths (mm) used as a starting scale; staff can edit per product.
DEFAULT_REAL_WIDTH_MM: dict[str, float] = {
    "necklace": 150.0,
    "chain": 140.0,
    "pendant": 140.0,
    "haram": 160.0,
    "choker": 125.0,
    "earrings": 22.0,
    "ring": 20.0,
    "bangle": 62.0,
    "bracelet": 60.0,
    "nose_ring": 12.0,
    "maang_tikka": 36.0,
    "waist_chain": 320.0,
    "anklet": 95.0,
}


@dataclass(frozen=True)
class CutoutOptions:
    """Per-photo hints for the pipeline (seed files and the admin uploader expose them)."""

    # Fraction of the photo to keep, (x0, y0, x1, y1) in 0..1, applied before everything else.
    crop: tuple[float, float, float, float] | None = None
    # Rotate the photo clockwise by 90/180/270 degrees (e.g. an anklet photographed upright).
    rotate: int = 0
    # Keep only the largest piece (None = default per jewellery type).
    single_piece: bool | None = None
    # Re-open holes the matting filled with background (inside a ring or a loop of chain).
    # None = on dark backdrops, only the large opening inside a loop (safe for dark stones);
    # True = every backdrop-coloured region; False = never.
    punch_holes: bool | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> CutoutOptions:
        data = data or {}
        crop = data.get("crop")
        return cls(
            crop=tuple(float(v) for v in crop) if crop else None,  # type: ignore[arg-type]
            rotate=int(data.get("rotate", 0) or 0),
            single_piece=data.get("single_piece"),
            punch_holes=data.get("punch_holes"),
        )


@dataclass(frozen=True)
class CutoutResult:
    png: bytes
    width: int
    height: int
    anchors: dict[str, list[float]]
    real_width_mm: float
    real_height_mm: float
    coverage: float  # fraction of the trimmed box that is opaque (quality hint)


class _Remover:
    _session: Any = None
    _lock = threading.Lock()

    @classmethod
    def session(cls, settings: Settings) -> Any:
        with cls._lock:
            if cls._session is None:
                model = settings.ai_models_dir / "u2net.onnx"
                if not model.is_file():
                    raise ServiceUnavailableError(
                        "Automatic cut-out needs the u2net.onnx model "
                        "(run scripts/download_models.sh).",
                        code="cutout_unavailable",
                    )
                os.environ.setdefault("U2NET_HOME", str(settings.ai_models_dir))
                from rembg import new_session

                cls._session = new_session("u2net")
            return cls._session


def _open_photo(data: bytes, options: CutoutOptions) -> Image.Image:
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.load()
            rgb = img.convert("RGB")
    except OSError as exc:
        raise UploadError() from exc
    if options.crop:
        x0, y0, x1, y1 = options.crop
        w, h = rgb.size
        box = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        if box[2] - box[0] < 8 or box[3] - box[1] < 8:
            raise UploadError("The crop region is too small.")
        rgb = rgb.crop(box)
    if options.rotate % 360:
        rgb = rgb.rotate(-(options.rotate % 360), expand=True)
    if max(rgb.size) > 2048:
        rgb.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    return rgb


def crop_photo(data: bytes, crop: tuple[float, float, float, float]) -> bytes:
    """The same fractional crop as the cut-out, for the catalogue photo itself."""
    rgb = _open_photo(data, CutoutOptions(crop=crop))
    buf = io.BytesIO()
    rgb.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def remove_background(
    data: bytes, settings: Settings, options: CutoutOptions | None = None
) -> np.ndarray:
    """RGBA uint8 array with the background made transparent."""
    from rembg import remove

    rgb = _open_photo(data, options or CutoutOptions())
    out = remove(
        rgb, session=_Remover.session(settings), alpha_matting=False, post_process_mask=True
    )
    rgba = np.asarray(out.convert("RGBA"), dtype=np.uint8).copy()
    # rembg blacks out the background's colour; keep the photo's own pixels so hole
    # punching can compare against the real backdrop and edges keep their true colour.
    rgba[..., :3] = np.asarray(rgb, dtype=np.uint8)
    return rgba


def _border_colour(rgb: np.ndarray) -> np.ndarray:
    """Median colour of a thin frame around the photo: the backdrop."""
    h, w = rgb.shape[:2]
    t = max(2, min(h, w) // 40)
    frame = np.concatenate(
        [
            rgb[:t].reshape(-1, 3),
            rgb[-t:].reshape(-1, 3),
            rgb[:, :t].reshape(-1, 3),
            rgb[:, -t:].reshape(-1, 3),
        ]
    )
    return np.asarray(np.median(frame, axis=0), dtype=np.float32)


def _punch_background_holes(
    rgba: np.ndarray,
    mask: np.ndarray,
    tolerance: float = 0.12,
    *,
    min_hole_fraction: float = 0.0,
) -> np.ndarray:
    """Matting fills enclosed holes (the inside of a ring, the loop of a necklace) with
    backdrop. Pixels inside the mask that share the backdrop's colour are released again,
    then dust is removed.

    ``min_hole_fraction`` > 0 releases only backdrop regions at least that fraction of the
    piece's area: the big opening inside a necklace or ring, never a dark stone, which is
    always small. Thin bridges between a stone and the opening are cut before measuring."""
    rgb = rgba[..., :3].astype(np.float32)
    bg = _border_colour(rgb)
    luma = rgb.mean(axis=2)
    if float(bg.mean()) < 40.0:
        near = np.linalg.norm(rgb - bg, axis=2) < 38.0
    else:
        # Chromaticity ignores the shading inside a hole (shadows, folds in fabric).
        total = rgb.sum(axis=2, keepdims=True) + 1e-3
        chroma = rgb / total
        bg_chroma = bg / (bg.sum() + 1e-3)
        near = (np.linalg.norm(chroma - bg_chroma, axis=2) < tolerance) & (
            np.abs(luma - float(bg.mean())) < 110.0
        )
    # Textured backdrops (fabric, paper) leave speckles: close them before releasing.
    near_u8 = np.asarray(near, dtype=np.uint8)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    near_u8 = np.asarray(cv2.morphologyEx(near_u8, cv2.MORPH_CLOSE, close_kernel), dtype=np.uint8)
    if min_hole_fraction > 0:
        candidate = (mask.astype(np.uint8) & near_u8).astype(np.uint8)
        bridge = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        cores = np.asarray(cv2.erode(candidate, bridge), dtype=np.uint8)
        count, labels, stats, _ = cv2.connectedComponentsWithStats(cores, connectivity=4)
        area = float(mask.sum()) or 1.0
        big = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] >= min_hole_fraction * area]
        if not big:
            return mask.astype(np.uint8)
        grown = np.asarray(
            cv2.dilate(np.isin(labels, big).astype(np.uint8), bridge, iterations=2),
            dtype=np.uint8,
        )
        near_u8 = (grown & candidate).astype(np.uint8)
    kept = (mask.astype(np.uint8) & (1 - near_u8)).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    kept = np.asarray(cv2.morphologyEx(kept, cv2.MORPH_OPEN, kernel), dtype=np.uint8)
    # Re-close pinholes inside gems and metal (small isolated background specks).
    holes = (mask.astype(np.uint8) - kept).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(holes, connectivity=4)
    small = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] < 0.0005 * mask.size]
    if small:
        kept[np.isin(labels, small)] = 1
    return kept


def _largest_components(alpha: np.ndarray, keep: int) -> np.ndarray:
    """Keep the ``keep`` largest connected blobs of the mask (drops dust and reflections)."""
    mask = (alpha > 16).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 2:
        return mask
    order = sorted(range(1, count), key=lambda i: -stats[i, cv2.CC_STAT_AREA])
    chosen = [
        i
        for i in order[:keep]
        if stats[i, cv2.CC_STAT_AREA] >= 0.02 * stats[order[0], cv2.CC_STAT_AREA]
    ]
    return np.isin(labels, chosen).astype(np.uint8)


def _trim(
    rgba: np.ndarray, mask: np.ndarray, pad_ratio: float = 0.04
) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        raise UploadError(
            "We couldn't find the jewellery in that photo. Use a clear photo on a plain background."
        )
    pad = int(max(rgba.shape[:2]) * pad_ratio)
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + pad + 1)
    cropped = rgba[y0:y1, x0:x1].copy()
    cropped[..., 3] = np.where(mask[y0:y1, x0:x1] > 0, cropped[..., 3], 0)
    return cropped, mask[y0:y1, x0:x1]


def _edge_points(mask: np.ndarray) -> dict[str, tuple[float, float]]:
    """Characteristic points of the opaque region in pixel coordinates."""
    h, w = mask.shape
    ys, xs = np.where(mask > 0)
    top_y = int(ys.min())
    top_xs = xs[ys <= top_y + max(2, h // 40)]
    left_col, right_col = int(xs.min()), int(xs.max())
    band = max(1, w // 50)
    left_rows = np.where(mask[:, left_col : left_col + band].any(axis=1))[0]
    right_rows = np.where(mask[:, max(0, right_col - band) : right_col + 1].any(axis=1))[0]
    left_top, right_top = int(left_rows.min()), int(right_rows.min())
    # Middle of each side's outermost run of rows: for a necklace laid in a closed loop this is
    # the widest point on both sides (level), for an open U it is near the clasp ends.
    left_mid, right_mid = int(np.median(left_rows)), int(np.median(right_rows))
    mid_row = int((ys.min() + ys.max()) / 2)
    row_xs = np.where(mask[mid_row])[0]
    return {
        "top": (float(top_xs.mean()), float(top_y)),
        "bottom": (float(xs[ys == ys.max()].mean()), float(ys.max())),
        "left_top": (float(left_col), float(left_top)),
        "right_top": (float(right_col), float(right_top)),
        "left_side": (float(left_col), float(left_mid)),
        "right_side": (float(right_col), float(right_mid)),
        "mid_left": (float(row_xs.min()) if len(row_xs) else float(left_col), float(mid_row)),
        "mid_right": (float(row_xs.max()) if len(row_xs) else float(right_col), float(mid_row)),
        "center": (float(xs.mean()), float(ys.mean())),
    }


def estimate_anchors(mask: np.ndarray, jewellery_type: str) -> dict[str, list[float]]:
    h, w = mask.shape
    p = _edge_points(mask)

    def n(pt: tuple[float, float]) -> list[float]:
        return [round(min(max(pt[0] / w, 0.0), 1.0), 4), round(min(max(pt[1] / h, 0.0), 1.0), 4)]

    if jewellery_type in {
        "necklace",
        "chain",
        "pendant",
        "haram",
        "choker",
        "waist_chain",
        "anklet",
    }:
        return {
            "left_end": n(p["left_side"]),
            "right_end": n(p["right_side"]),
            "bottom": n(p["bottom"]),
        }
    if jewellery_type == "earrings":
        return {"top": n(p["top"]), "bottom": n(p["bottom"])}
    if jewellery_type == "ring":
        return {
            "band_left": n(p["mid_left"]),
            "band_right": n(p["mid_right"]),
            "center": n(p["center"]),
            "top": n(p["top"]),
        }
    if jewellery_type in {"bangle", "bracelet"}:
        return {"left": n(p["mid_left"]), "right": n(p["mid_right"]), "center": n(p["center"])}
    if jewellery_type == "nose_ring":
        return {"pivot": n(p["left_top"]), "center": n(p["center"])}
    if jewellery_type == "maang_tikka":
        cx, cy = p["center"]
        return {
            "top": n(p["top"]),
            "pendant_center": n((cx, (cy + p["bottom"][1]) / 2)),
            "bottom": n(p["bottom"]),
        }
    return {"center": n(p["center"])}


def make_tryon_asset(
    data: bytes,
    jewellery_type: str,
    settings: Settings,
    *,
    single_piece: bool | None = None,
    options: CutoutOptions | None = None,
) -> CutoutResult:
    """Full pipeline: photo bytes → transparent PNG + anchors for the given jewellery type."""
    options = options or CutoutOptions()
    if single_piece is not None:
        options = CutoutOptions(
            crop=options.crop,
            rotate=options.rotate,
            single_piece=single_piece,
            punch_holes=options.punch_holes,
        )
    rgba = remove_background(data, settings, options)
    keep_single = (
        options.single_piece
        if options.single_piece is not None
        else jewellery_type in {"earrings", "bangle", "bracelet", "ring", "nose_ring"}
    )
    mask = (rgba[..., 3] > 16).astype(np.uint8)
    # Default: release only the large opening inside a loop or ring. Dark stones on a dark
    # backdrop look exactly like it, so a full punch is opt-in (punch_holes=True).
    if options.punch_holes is None:
        # Only on dark backdrops: on white/cream ones pearls and diamonds share the colour.
        if float(_border_colour(rgba[..., :3].astype(np.float32)).mean()) < 40.0:
            mask = _punch_background_holes(rgba, mask, min_hole_fraction=0.08)
    elif options.punch_holes:
        mask = _punch_background_holes(rgba, mask)
    mask = _largest_components(mask * 255, keep=1 if keep_single else 6)
    cropped, cropped_mask = _trim(rgba, mask)
    anchors = estimate_anchors(cropped_mask, jewellery_type)
    real_w = DEFAULT_REAL_WIDTH_MM.get(jewellery_type, 50.0)
    h, w = cropped_mask.shape
    buf = io.BytesIO()
    Image.fromarray(cropped).save(buf, format="PNG", optimize=True)
    coverage = float(cropped_mask.mean())
    return CutoutResult(
        png=buf.getvalue(),
        width=w,
        height=h,
        anchors=anchors,
        real_width_mm=real_w,
        real_height_mm=round(real_w * h / w, 2),
        coverage=coverage,
    )
