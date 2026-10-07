from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import APIModel


class AdjustmentsIn(APIModel):
    offset_x: float = Field(default=0, ge=-4000, le=4000)
    offset_y: float = Field(default=0, ge=-4000, le=4000)
    scale: float = Field(default=1.0, gt=0.2, lt=5.0)
    rotation_deg: float = Field(default=0, ge=-180, le=180)


class TryOnItemIn(APIModel):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    size_id: uuid.UUID | None = None
    slot: str | None = Field(default=None, max_length=32, pattern=r"^[a-z_]+$")
    adjustments: AdjustmentsIn = Field(default_factory=AdjustmentsIn)


class TryOnItemsIn(APIModel):
    items: list[TryOnItemIn] = Field(min_length=1, max_length=8)


class TryOnRerunIn(TryOnItemsIn):
    mode: Literal["look", "bridal"] = "look"


class RingSizeOut(APIModel):
    finger: str
    handedness: str
    width_mm: float
    inner_diameter_mm: float
    circumference_mm: float
    indian_size: int
    us_size: float
    confidence: str
    is_estimate: bool = True
    note: str


class PlacementOut(APIModel):
    region: str
    matrix: list[list[float]]
    bbox: list[int]
    confidence: float
    asset_id: str | None
    product_id: uuid.UUID | None = None


class TryOnResultOut(APIModel):
    id: uuid.UUID
    session_id: uuid.UUID
    photo_id: uuid.UUID
    status: str
    result_url: str | None
    width: int | None
    height: int | None
    confidence: float | None
    warnings: list[str]
    placements: list[PlacementOut]
    detection: dict[str, Any]
    ring_size_estimate: RingSizeOut | None
    engine_version: str | None
    processing_ms: int | None
    items: list[TryOnItemIn]


class CustomerPhotoOut(APIModel):
    id: uuid.UUID
    url: str
    width: int
    height: int
    detection: dict[str, Any] | None
    created_at: str
    expires_at: str | None


class TryOnCapabilitiesOut(APIModel):
    photo_tryon: bool
    live_tryon: bool
    supported_types: list[str]
    max_upload_mb: int
    models_url_prefix: str = "/models"
