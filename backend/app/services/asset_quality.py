"""Catalogue asset quality: is this product ready for a premium shop and for try-on?

Measured from the stored files (no AI model): resolution, sharpness and exposure of the
photos, transparency, coverage, anchors and physical size of the try-on cut-out, and which
optional assets exist. Each check is pass / warn / fail with a plain-language fix; the
score weights what customers notice most (sharp photos and a usable cut-out).
"""

from __future__ import annotations

import asyncio
import io
from dataclasses import dataclass, field
from typing import Literal

import cv2
import numpy as np
from PIL import Image

from app.models.catalogue import Product
from app.storage import ObjectStorage

Status = Literal["pass", "warn", "fail"]

REQUIRED_ANCHORS: dict[str, set[str]] = {
    "necklace": {"left_end", "right_end"},
    "chain": {"left_end", "right_end"},
    "pendant": {"left_end", "right_end"},
    "haram": {"left_end", "right_end"},
    "choker": {"left_end", "right_end"},
    "earrings": {"top"},
    "ring": {"band_left", "band_right"},
    "bangle": {"left", "right"},
    "bracelet": {"left", "right"},
    "nose_ring": {"pivot"},
    "maang_tikka": {"top", "pendant_center"},
    "waist_chain": {"left_end", "right_end"},
    "anklet": {"left_end", "right_end"},
}


@dataclass
class QualityCheck:
    key: str
    label: str
    status: Status
    detail: str
    weight: float


@dataclass
class QualityReport:
    score: int
    checks: list[QualityCheck] = field(default_factory=list)
    tryon_ready: bool = False


def _metrics(data: bytes) -> dict[str, float]:
    with Image.open(io.BytesIO(data)) as img:
        img.load()
        has_alpha = img.mode in {"RGBA", "LA"} or "transparency" in img.info
        rgba = np.asarray(img.convert("RGBA"))
    h, w = rgba.shape[:2]
    alpha = rgba[..., 3]
    gray = cv2.cvtColor(np.ascontiguousarray(rgba[..., :3]), cv2.COLOR_RGB2GRAY)
    # Measure on a fixed-size copy so the numbers are comparable across resolutions.
    scale = 1024 / max(h, w)
    small = cv2.resize(gray, (max(1, int(w * scale)), max(1, int(h * scale))))
    small_alpha = cv2.resize(alpha, (small.shape[1], small.shape[0]))
    inside = small_alpha > 200 if has_alpha else np.ones_like(small, dtype=bool)
    lap = cv2.Laplacian(small.astype(np.float32) / 255.0, cv2.CV_32F)
    sharpness = float(lap[inside].var()) if inside.sum() > 100 else float(lap.var())
    values = small[inside] if inside.sum() > 100 else small.ravel()
    # Only blown highlights count: deep black backdrops are a deliberate luxury style.
    clipped = float((values > 250).mean())
    border = np.concatenate(
        [small[:8].ravel(), small[-8:].ravel(), small[:, :8].ravel(), small[:, -8:].ravel()]
    )
    return {
        "width": float(w),
        "height": float(h),
        "has_alpha": float(has_alpha),
        "coverage": float((alpha > 16).mean()) if has_alpha else 1.0,
        "sharpness": sharpness,
        "exposure": float(values.mean()) / 255.0,
        "clipped": clipped,
        "background_spread": float(border.std()) / 255.0,
    }


async def assess_product(product: Product, storage: ObjectStorage) -> QualityReport:
    checks: list[QualityCheck] = []
    images = [i for i in product.images if i.view != "worn"]
    primary = next((i for i in images if i.is_primary), images[0] if images else None)

    if primary is None:
        checks.append(
            QualityCheck("photo", "Product photo", "fail", "Upload at least one product photo.", 3)
        )
    else:
        m = await asyncio.to_thread(_metrics, await storage.get(primary.storage_key))
        long_side = max(m["width"], m["height"])
        checks.append(
            QualityCheck(
                "resolution",
                "Resolution",
                "pass" if long_side >= 1200 else "warn" if long_side >= 800 else "fail",
                f"{int(m['width'])} x {int(m['height'])} px"
                + ("" if long_side >= 1200 else " — 1200 px or more keeps zoom crisp."),
                2,
            )
        )
        checks.append(
            QualityCheck(
                "sharpness",
                "Sharpness",
                "pass"
                if m["sharpness"] >= 0.002
                else "warn"
                if m["sharpness"] >= 0.0008
                else "fail",
                "Crisp detail."
                if m["sharpness"] >= 0.002
                else "The photo looks soft; refocus on the stones or use a tripod.",
                2,
            )
        )
        exposure_ok = 0.04 <= m["exposure"] <= 0.9 and m["clipped"] < 0.05
        checks.append(
            QualityCheck(
                "lighting",
                "Lighting",
                "pass" if exposure_ok else "warn",
                "Even exposure."
                if exposure_ok
                else "Highlights are blown out or the photo is underexposed; soften the light or "
                "adjust exposure.",
                1.5,
            )
        )
        checks.append(
            QualityCheck(
                "background",
                "Background",
                "pass" if m["background_spread"] < 0.08 else "warn",
                "Clean, even backdrop."
                if m["background_spread"] < 0.08
                else "Busy backdrop; a plain white, grey or black background looks premium and "
                "cuts out cleanly.",
                1,
            )
        )
    views = {i.view for i in images}
    extra = len(views - {"front"})
    checks.append(
        QualityCheck(
            "angles",
            "More angles",
            "pass" if extra >= 2 else "warn",
            f"{len(images)} photo(s): {', '.join(sorted(views)) or 'none'}"
            + ("" if extra >= 2 else " — add side, 45° or detail shots."),
            1,
        )
    )

    tryon_ready = False
    if product.jewellery_type == "set":
        checks.append(
            QualityCheck("tryon", "Try-on", "pass", "Sets are tried on through their pieces.", 0)
        )
        tryon_ready = True
    elif not product.tryon_assets:
        checks.append(
            QualityCheck(
                "tryon",
                "Try-on cut-out",
                "fail",
                "No cut-out yet, so “Try It On” is hidden. Upload the front photo with Auto "
                "cut-out.",
                3,
            )
        )
    else:
        asset = next(
            (a for a in product.tryon_assets if a.variant_id is None), product.tryon_assets[0]
        )
        m = await asyncio.to_thread(_metrics, await storage.get(asset.storage_key))
        transparent = bool(m["has_alpha"]) and m["coverage"] < 0.95
        checks.append(
            QualityCheck(
                "transparency",
                "Transparency",
                "pass" if transparent else "fail",
                "Background removed." if transparent else "The cut-out still has its background.",
                2,
            )
        )
        required = REQUIRED_ANCHORS.get(product.jewellery_type, set())
        missing = sorted(required - set(asset.anchors))
        checks.append(
            QualityCheck(
                "anchors",
                "Anchor points",
                "pass" if not missing else "fail",
                "All placement points set."
                if not missing
                else f"Missing: {', '.join(m.replace('_', ' ') for m in missing)}.",
                2,
            )
        )
        long_side = max(m["width"], m["height"])
        checks.append(
            QualityCheck(
                "tryon_resolution",
                "Cut-out detail",
                "pass" if long_side >= 600 else "warn",
                f"{int(m['width'])} x {int(m['height'])} px"
                + ("" if long_side >= 600 else " — a larger photo keeps fine chains visible."),
                1,
            )
        )
        checks.append(
            QualityCheck(
                "size",
                "Real size",
                "pass" if asset.real_width_mm else "warn",
                f"{asset.real_width_mm} mm wide"
                if asset.real_width_mm
                else "Enter the real width so the piece is the right size on customers.",
                1.5,
            )
        )
        coverage_ok = 0.05 <= m["coverage"] <= 0.85
        checks.append(
            QualityCheck(
                "coverage",
                "Cut-out cleanliness",
                "pass" if coverage_ok else "warn",
                "Piece fills the cut-out cleanly."
                if coverage_ok
                else "Little of the piece survived, or extra background remains; check the "
                "preview and retake if needed.",
                1,
            )
        )
        tryon_ready = transparent and not missing
    checks.append(
        QualityCheck(
            "model3d",
            "3D model",
            "pass" if product.model_3d_assets else "warn",
            "360° viewer enabled."
            if product.model_3d_assets
            else "Optional: a GLB from CAD or a scan enables the 360° viewer.",
            0.5,
        )
    )
    points = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
    total = sum(c.weight for c in checks) or 1.0
    score = round(100 * sum(points[c.status] * c.weight for c in checks) / total)
    return QualityReport(score=score, checks=checks, tryon_ready=tryon_ready)
