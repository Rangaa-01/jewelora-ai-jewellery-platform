"""Optional generative refinement of a deterministic try-on render.

The deterministic renderer decides *what* is drawn and *where* (the shop's actual piece,
fitted to the customer). A refinement provider may only improve how it blends in: lighting,
contact and edges. Two guards make that a hard rule, whatever the model returns:

* identity guard — outside a thin band around the jewellery, every pixel is the customer's
  original pixel (face, skin, hair and background are never changed);
* product guard — inside the solid body of the jewellery, every pixel is the deterministic
  render of the shop's photo (stones, count, colour and shape cannot be redrawn).

Only the band where jewellery meets body (edges, contact shadows) takes the model's pixels.
"""

from __future__ import annotations

import io
import json
import urllib.request
from dataclasses import dataclass
from typing import Protocol

import cv2
import numpy as np
from PIL import Image


class RefinementError(Exception):
    pass


class RefinementProvider(Protocol):
    name: str

    @property
    def available(self) -> bool: ...

    def refine(self, original: np.ndarray, draft: np.ndarray, coverage: np.ndarray) -> np.ndarray:
        """Return a refined RGB image of the same size as ``draft``."""
        ...


class NoRefinement:
    name = "none"

    @property
    def available(self) -> bool:
        return False

    def refine(self, original: np.ndarray, draft: np.ndarray, coverage: np.ndarray) -> np.ndarray:
        return draft


def _png(rgb: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG")
    return buf.getvalue()


@dataclass
class HttpRefinement:
    """Calls a self-hosted or cloud inpainting service.

    Contract: ``POST url`` with JSON ``{"image": <hex PNG draft>, "mask": <hex PNG band>,
    "prompt": "..."}`` and an optional bearer token; the response body is the refined PNG.
    Any image-to-image/inpainting model (e.g. an SDXL or FLUX inpainting server) can sit
    behind it. The band mask marks the only pixels the model may change.
    """

    url: str
    token: str | None = None
    timeout_s: float = 60.0
    name: str = "http"

    def __post_init__(self) -> None:
        if not self.url.startswith(("https://", "http://")):
            raise ValueError("refinement URL must be http(s)")

    @property
    def available(self) -> bool:
        return bool(self.url)

    def refine(self, original: np.ndarray, draft: np.ndarray, coverage: np.ndarray) -> np.ndarray:
        band = refinement_band(coverage)
        payload = json.dumps(
            {
                "image": _png(draft).hex(),
                "mask": _png((band * 255).astype(np.uint8)).hex(),
                "prompt": (
                    "photograph, natural contact shadow and reflections where the jewellery "
                    "touches skin, keep everything else identical"
                ),
            }
        ).encode()
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        # Scheme validated in __post_init__ (http/https only).
        request = urllib.request.Request(  # noqa: S310
            self.url, data=payload, headers=headers, method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as response:  # noqa: S310
                body = response.read()
        except OSError as exc:
            raise RefinementError(f"refinement service unreachable: {exc}") from exc
        try:
            refined = np.asarray(Image.open(io.BytesIO(body)).convert("RGB"), dtype=np.uint8)
        except OSError as exc:
            raise RefinementError("refinement service returned an invalid image") from exc
        if refined.shape != draft.shape:
            refined = np.asarray(
                cv2.resize(refined, (draft.shape[1], draft.shape[0])), dtype=np.uint8
            )
        return refined


def refinement_band(coverage: np.ndarray, width_px: int | None = None) -> np.ndarray:
    """0..1 mask of the edge/contact band: around the jewellery, excluding its solid core."""
    h, w = coverage.shape
    width = width_px or max(3, round(max(h, w) / 300))
    solid = (coverage > 0.9).astype(np.uint8)
    present = (coverage > 0.02).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * width + 1, 2 * width + 1))
    grown = cv2.dilate(present, kernel)
    core = cv2.erode(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    band = np.clip(grown.astype(np.float32) - core.astype(np.float32), 0.0, 1.0)
    return cv2.GaussianBlur(band, (0, 0), max(1.0, width / 2))


def apply_guards(
    original: np.ndarray, draft: np.ndarray, refined: np.ndarray, coverage: np.ndarray
) -> np.ndarray:
    """Keep the customer outside the band and the product inside its core (see module doc)."""
    band = refinement_band(coverage)[..., None]
    core = (coverage > 0.9).astype(np.float32)[..., None]
    # Outside the band: the deterministic draft, which is the customer's original photo plus
    # only the jewellery and its soft shadow. ``original`` is accepted for providers that
    # want to diff against it; the guard never needs more than the draft.
    del original
    draft_f = draft.astype(np.float32)
    out = draft_f * (1 - band) + refined.astype(np.float32) * band
    out = out * (1 - core) + draft_f * core
    return np.asarray(np.clip(out + 0.5, 0, 255), dtype=np.uint8)


def provider_from_settings(kind: str, url: str | None, token: str | None) -> RefinementProvider:
    if kind == "http" and url:
        return HttpRefinement(url=url, token=token)
    return NoRefinement()
