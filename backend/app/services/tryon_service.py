"""Photo try-on orchestration: uploads, detection caching, engine runs, result storage."""

from __future__ import annotations

import asyncio
import json
import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    AuthorizationError,
    NotFoundError,
    ServiceUnavailableError,
    TryOnError,
    ValidationAppError,
)
from app.core.logging import get_logger
from app.core.settings import Settings
from app.models.catalogue import Product, ProductTryOnAsset
from app.models.enums import AnalyticsEventType, TryOnStatus
from app.models.tryon import CustomerPhoto, TryOnResult, TryOnSession
from app.schemas.tryon import AdjustmentsIn, TryOnItemIn
from app.services.analytics_service import record_event
from app.services.catalogue_service import CatalogueService
from app.services.upload_service import process_image
from app.storage import ObjectStorage
from app.storage.base import customer_photo_key, tryon_result_key

log = get_logger(__name__)

SUPPORTED_TYPES = [
    "necklace", "chain", "pendant", "haram", "choker", "earrings", "ring", "bangle", "bracelet",
    "nose_ring", "maang_tikka", "waist_chain", "anklet",
]  # fmt: skip


@dataclass
class Owner:
    customer_id: uuid.UUID | None
    session_token: str | None

    def owns(self, customer_id: uuid.UUID | None, session_token: str | None) -> bool:
        if self.customer_id is not None and customer_id == self.customer_id:
            return True
        return bool(self.session_token) and session_token == self.session_token

    @property
    def key(self) -> str:
        return str(self.customer_id) if self.customer_id else f"anon-{self.session_token}"


class EngineRuntime:
    """Process-wide lazy holder for the AI engine and an asset cache."""

    _instance: EngineRuntime | None = None
    _lock = threading.Lock()

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._engine: Any = None
        self._asset_cache: OrderedDict[str, Any] = OrderedDict()
        self._asset_lock = threading.Lock()

    @classmethod
    def get(cls, settings: Settings) -> EngineRuntime:
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(settings)
            return cls._instance

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._instance = None

    @property
    def available(self) -> bool:
        from jewelora_ai.models import models_available

        return self.settings.ai_enabled and models_available(self.settings.ai_models_dir)

    def engine(self) -> Any:
        if self._engine is None:
            if not self.available:
                raise ServiceUnavailableError(
                    "Virtual try-on is temporarily unavailable. Please try again shortly.",
                    code="tryon_unavailable",
                )
            from jewelora_ai.detectors.mediapipe_detector import MediaPipeLandmarkDetector
            from jewelora_ai.engine import TryOnEngine
            from jewelora_ai.segmentation.mediapipe_segmenter import MediaPipeSegmenter

            models_dir = self.settings.ai_models_dir
            self._engine = TryOnEngine(
                detector=MediaPipeLandmarkDetector(models_dir),
                segmenter=MediaPipeSegmenter(models_dir),
            )
            log.info("tryon_engine_loaded", models_dir=str(models_dir))
        return self._engine

    def cache_get(self, key: str) -> Any | None:
        with self._asset_lock:
            if key in self._asset_cache:
                self._asset_cache.move_to_end(key)
                return self._asset_cache[key]
        return None

    def cache_put(self, key: str, value: Any) -> None:
        with self._asset_lock:
            self._asset_cache[key] = value
            if len(self._asset_cache) > 64:
                self._asset_cache.popitem(last=False)


class TryOnService:
    def __init__(self, db: AsyncSession, storage: ObjectStorage, settings: Settings) -> None:
        self.db = db
        self.storage = storage
        self.settings = settings
        self.runtime = EngineRuntime.get(settings)

    # --- photos ---------------------------------------------------------------------------

    async def store_photo(self, owner: Owner, data: bytes) -> CustomerPhoto:
        processed = process_image(
            data, self.settings, max_dimension=self.settings.tryon_max_dimension
        )
        key = customer_photo_key(owner.key, processed.extension)
        await self.storage.put(key, processed.data, processed.content_type)
        photo = CustomerPhoto(
            customer_id=owner.customer_id,
            session_token=owner.session_token if owner.customer_id is None else None,
            storage_key=key,
            width=processed.width,
            height=processed.height,
            content_type=processed.content_type,
            expires_at=datetime.now(UTC)
            + timedelta(days=self.settings.customer_photo_retention_days),
        )
        self.db.add(photo)
        await self.db.flush()
        return photo

    async def get_photo(self, owner: Owner, photo_id: uuid.UUID) -> CustomerPhoto:
        photo = await self.db.get(CustomerPhoto, photo_id)
        if photo is None or photo.is_deleted:
            raise NotFoundError(code="photo_not_found")
        if not owner.owns(photo.customer_id, photo.session_token):
            raise AuthorizationError()
        return photo

    async def list_photos(self, owner: Owner) -> list[CustomerPhoto]:
        stmt = (
            select(CustomerPhoto)
            .where(CustomerPhoto.is_deleted.is_(False))
            .order_by(CustomerPhoto.created_at.desc())
        )
        if owner.customer_id:
            stmt = stmt.where(CustomerPhoto.customer_id == owner.customer_id)
        elif owner.session_token:
            stmt = stmt.where(CustomerPhoto.session_token == owner.session_token)
        else:
            return []
        return list((await self.db.execute(stmt)).scalars().all())

    async def delete_photo(self, owner: Owner, photo_id: uuid.UUID) -> None:
        photo = await self.get_photo(owner, photo_id)
        photo.is_deleted = True
        await self.storage.delete(photo.storage_key)
        results = (
            (await self.db.execute(select(TryOnResult).where(TryOnResult.photo_id == photo.id)))
            .scalars()
            .all()
        )
        for result in results:
            if result.result_storage_key:
                await self.storage.delete(result.result_storage_key)
                result.result_storage_key = None
        await self.db.flush()

    # --- engine helpers ---------------------------------------------------------------------

    async def _landmarks_for(self, photo: CustomerPhoto, image: np.ndarray) -> Any:
        from jewelora_ai.detectors.fixture_detector import landmarks_from_json, landmarks_to_json

        if photo.landmarks:
            return landmarks_from_json(photo.landmarks)
        engine = self.runtime.engine()
        landmarks = await asyncio.to_thread(engine.detect, image)
        photo.landmarks = landmarks_to_json(landmarks)
        photo.detection_summary = landmarks.summary()
        return landmarks

    async def _load_image(self, photo: CustomerPhoto) -> np.ndarray:
        from jewelora_ai.preprocessing import load_rgb

        data = await self.storage.get(photo.storage_key)
        return load_rgb(data, max_dimension=self.settings.tryon_max_dimension).rgb

    def _select_asset(
        self, product: Product, variant_id: uuid.UUID | None
    ) -> ProductTryOnAsset | None:
        assets = [a for a in product.tryon_assets if a.view == "front"] or list(
            product.tryon_assets
        )
        if not assets:
            return None
        if variant_id:
            for asset in assets:
                if asset.variant_id == variant_id:
                    return asset
        for asset in assets:
            if asset.variant_id is None:
                return asset
        return assets[0]

    async def _build_items(
        self, items: list[TryOnItemIn]
    ) -> tuple[list[tuple[Any, TryOnItemIn]], list[str]]:
        from jewelora_ai.datatypes import Adjustments, AssetSpec, JewelleryType, Point, TryOnItem
        from jewelora_ai.preprocessing import load_rgba_asset

        catalogue = CatalogueService(self.db)
        products = {
            p.id: p for p in await catalogue.get_products_by_ids([i.product_id for i in items])
        }
        built: list[tuple[Any, TryOnItemIn]] = []
        warnings: list[str] = []
        for item in items:
            product = products.get(item.product_id)
            if product is None:
                raise ValidationAppError(
                    "One of the selected pieces is no longer available.", code="product_not_found"
                )
            if product.jewellery_type not in SUPPORTED_TYPES:
                warnings.append(f"{product.name} can't be tried on virtually yet.")
                continue
            asset_row = self._select_asset(product, item.variant_id)
            if asset_row is None or not product.tryon_enabled:
                warnings.append(f"{product.name} doesn't have a try-on image yet.")
                continue
            tint = None
            if item.variant_id and asset_row.variant_id != item.variant_id:
                variant = next((v for v in product.variants if v.id == item.variant_id), None)
                tint = variant.tint_hex if variant else None

            key = asset_row.storage_key
            cached = self.runtime.cache_get(key)
            image: np.ndarray
            if cached is None:
                image = await asyncio.to_thread(load_rgba_asset, await self.storage.get(key))
                self.runtime.cache_put(key, image)
            else:
                image = cached
            spec = AssetSpec(
                image=image,
                anchors={k: Point(float(v[0]), float(v[1])) for k, v in asset_row.anchors.items()},
                jewellery_type=JewelleryType(product.jewellery_type),
                real_width_mm=float(asset_row.real_width_mm) if asset_row.real_width_mm else None,
                real_height_mm=float(asset_row.real_height_mm)
                if asset_row.real_height_mm
                else None,
                asset_id=str(asset_row.id),
            )
            built.append(
                (
                    TryOnItem(
                        asset=spec,
                        slot=item.slot,
                        adjustments=Adjustments(**item.adjustments.model_dump()),
                        tint_hex=tint,
                    ),
                    item,
                )
            )
        if not built:
            raise TryOnError(
                warnings[0] if warnings else "None of the selected pieces can be tried on yet.",
                code="no_tryon_assets",
            )
        return built, warnings

    # --- runs ----------------------------------------------------------------------------------

    async def run_photo_tryon(
        self,
        owner: Owner,
        *,
        photo: CustomerPhoto,
        items: list[TryOnItemIn],
        mode: str,
        device_info: dict[str, Any] | None,
        session: TryOnSession | None = None,
        user_agent: str | None = None,
    ) -> TryOnResult:
        from jewelora_ai.datatypes import TryOnRequest
        from jewelora_ai.engine import TryOnError as EngineError
        from jewelora_ai.preprocessing import encode_image

        engine = self.runtime.engine()
        image = await self._load_image(photo)
        landmarks = await self._landmarks_for(photo, image)
        pairs, warnings = await self._build_items(items)
        built = [engine_item for engine_item, _ in pairs]
        asset_to_product = {
            engine_item.asset.asset_id: str(src.product_id) for engine_item, src in pairs
        }
        if session is None:
            session = TryOnSession(
                customer_id=owner.customer_id,
                session_token=owner.session_token,
                mode=mode,
                photo_id=photo.id,
                device_info=device_info,
            )
            self.db.add(session)
            await self.db.flush()
        result = TryOnResult(
            session_id=session.id,
            photo_id=photo.id,
            status=TryOnStatus.PROCESSING.value,
            items=[i.model_dump(mode="json") for i in items],
        )
        self.db.add(result)
        await self.db.flush()
        try:
            outcome = await asyncio.to_thread(
                engine.run, TryOnRequest(image=image, items=built, landmarks=landmarks)
            )
        except EngineError as exc:
            result.status = TryOnStatus.FAILED.value
            result.error_code = exc.code
            result.error_detail = exc.message
            result.warnings = warnings
            await self.db.flush()
            log.info("tryon_failed", result_id=str(result.id), code=exc.code)
            raise TryOnError(exc.message, code=exc.code) from exc
        except Exception as exc:  # unexpected engine failure
            result.status = TryOnStatus.FAILED.value
            result.error_code = "engine_error"
            result.error_detail = repr(exc)[:2000]
            await self.db.flush()
            log.exception("tryon_engine_error", result_id=str(result.id))
            raise TryOnError(code="engine_error") from exc

        encoded = encode_image(outcome.image, fmt="WEBP", quality=90)
        key = tryon_result_key(owner.key, "webp")
        await self.storage.put(key, encoded, "image/webp")
        result.status = TryOnStatus.COMPLETED.value
        result.result_storage_key = key
        result.result_width = int(outcome.image.shape[1])
        result.result_height = int(outcome.image.shape[0])
        result.engine_version = outcome.engine_version
        result.processing_ms = outcome.processing_ms
        result.confidence = outcome.confidence
        result.warnings = [*warnings, *outcome.warnings]
        result.placements = {
            "items": [
                {**p.to_dict(), "product_id": asset_to_product.get(p.asset_id)}
                for p in outcome.placements
            ],
            "ring_size_estimate": outcome.ring_size_estimate,
            "detection": landmarks.summary(),
        }
        await self.db.flush()
        for item in items:
            product = await self.db.get(Product, item.product_id)
            if product is not None:
                product.tryon_count += 1
            await record_event(
                self.db,
                AnalyticsEventType.PRODUCT_TRYON,
                product_id=item.product_id,
                customer_id=owner.customer_id,
                session_token=owner.session_token,
                properties={"mode": mode, "result_id": str(result.id)},
                user_agent=user_agent,
            )
        log.info(
            "tryon_completed",
            result_id=str(result.id),
            ms=outcome.processing_ms,
            confidence=round(outcome.confidence, 2),
        )
        return result

    async def get_result(self, owner: Owner, result_id: uuid.UUID) -> TryOnResult:
        result = await self.db.get(TryOnResult, result_id)
        if result is None:
            raise NotFoundError(code="result_not_found")
        session = await self.db.get(TryOnSession, result.session_id)
        if session is None or not owner.owns(session.customer_id, session.session_token):
            raise AuthorizationError()
        return result

    async def adjust_result(
        self, owner: Owner, result_id: uuid.UUID, items: list[TryOnItemIn]
    ) -> TryOnResult:
        """Re-render an existing result with new adjustments/items, reusing cached landmarks."""
        previous = await self.get_result(owner, result_id)
        if previous.photo_id is None:
            raise NotFoundError(code="photo_not_found")
        photo = await self.get_photo(owner, previous.photo_id)
        session = await self.db.get(TryOnSession, previous.session_id)
        assert session is not None
        return await self.run_photo_tryon(
            owner, photo=photo, items=items, mode=session.mode, device_info=None, session=session
        )


def apply_adjustments(
    items: list[TryOnItemIn], updates: dict[str, AdjustmentsIn]
) -> list[TryOnItemIn]:
    out = []
    for item in items:
        adj = updates.get(str(item.product_id))
        out.append(item.model_copy(update={"adjustments": adj}) if adj else item)
    return out


def result_items(result: TryOnResult) -> list[TryOnItemIn]:
    return [TryOnItemIn.model_validate(i) for i in result.items]


def parse_items_json(raw: str | None) -> list[TryOnItemIn]:
    from pydantic import ValidationError

    from app.schemas.tryon import TryOnItemsIn

    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError as exc:
        raise ValidationAppError(
            "Selected pieces could not be read.", code="invalid_items"
        ) from exc
    try:
        return TryOnItemsIn(items=data).items
    except ValidationError as exc:
        raise ValidationAppError(details=json.loads(exc.json())) from exc
