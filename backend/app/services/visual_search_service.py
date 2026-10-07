"""Visual search: embed the query image and compare against indexed product images."""

from __future__ import annotations

import asyncio
import threading
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import numpy as np
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ServiceUnavailableError
from app.core.logging import get_logger
from app.core.settings import Settings
from app.models.catalogue import Product, ProductEmbedding
from app.models.enums import AnalyticsEventType
from app.schemas.catalogue import ProductFilters
from app.services.analytics_service import record_event
from app.services.catalogue_service import CatalogueService
from app.storage import ObjectStorage

log = get_logger(__name__)

EXACT_THRESHOLD = 0.97
SIMILAR_THRESHOLD = 0.55


class EmbedderRuntime:
    _instance: Any = None
    _lock = threading.Lock()

    @classmethod
    def get(cls, settings: Settings) -> Any:
        with cls._lock:
            if cls._instance is None:
                from jewelora_ai.embeddings import MediaPipeImageEmbedder
                from jewelora_ai.models import models_available

                if not settings.ai_enabled or not models_available(settings.ai_models_dir):
                    raise ServiceUnavailableError(
                        "Visual search is temporarily unavailable.",
                        code="visual_search_unavailable",
                    )
                cls._instance = MediaPipeImageEmbedder(settings.ai_models_dir)
            return cls._instance

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            cls._instance = None


class VisualSearchService:
    def __init__(self, db: AsyncSession, storage: ObjectStorage, settings: Settings) -> None:
        self.db = db
        self.storage = storage
        self.settings = settings

    async def _embed_bytes(self, data: bytes) -> np.ndarray:
        from jewelora_ai.preprocessing import load_rgb

        embedder = EmbedderRuntime.get(self.settings)
        rgb = load_rgb(data, max_dimension=640, min_dimension=64).rgb
        return await asyncio.to_thread(embedder.embed, rgb)

    async def index_product(self, product: Product) -> int:
        """(Re)compute embeddings for every image of a product. Returns the count indexed."""
        from jewelora_ai.embeddings import EMBEDDING_MODEL_NAME

        await self.db.execute(
            delete(ProductEmbedding).where(ProductEmbedding.product_id == product.id)
        )
        count = 0
        for image in product.images:
            try:
                vector = await self._embed_bytes(await self.storage.get(image.storage_key))
            except Exception:
                log.exception("embedding_failed", image_id=str(image.id))
                continue
            self.db.add(
                ProductEmbedding(
                    product_image_id=image.id,
                    product_id=product.id,
                    model_name=EMBEDDING_MODEL_NAME,
                    dimension=int(vector.shape[0]),
                    vector=[Decimal(str(round(float(v), 6))) for v in vector],
                    created_at=datetime.now(UTC),
                )
            )
            count += 1
        await self.db.flush()
        return count

    async def index_all(self) -> int:
        products, _ = await CatalogueService(self.db).list_products(
            ProductFilters(page_size=96), include_inactive=True
        )
        total = 0
        for product in products:
            total += await self.index_product(product)
        return total

    async def search(
        self, data: bytes, *, limit: int, customer_id: uuid.UUID | None, session_token: str | None
    ) -> tuple[tuple[Product, float] | None, list[tuple[Product, float]], int]:
        query = await self._embed_bytes(data)
        rows = (
            await self.db.execute(
                select(ProductEmbedding.product_id, ProductEmbedding.vector)
                .join(Product, Product.id == ProductEmbedding.product_id)
                .where(Product.is_active.is_(True))
            )
        ).all()
        if not rows:
            return None, [], 0
        raw = np.asarray([[float(v) for v in vector] for _, vector in rows], dtype=np.float32)
        norms = np.linalg.norm(raw, axis=1, keepdims=True)
        matrix = (raw / np.where(norms == 0, 1, norms)).astype(np.float32)
        sims = matrix @ query
        best: dict[uuid.UUID, float] = {}
        for (product_id, _), sim in zip(rows, sims, strict=True):
            best[product_id] = max(best.get(product_id, -1.0), float(sim))
        ranked = sorted(best.items(), key=lambda kv: -kv[1])[: limit + 1]
        products = {
            p.id: p
            for p in await CatalogueService(self.db).get_products_by_ids([pid for pid, _ in ranked])
        }
        ordered = [(products[pid], score) for pid, score in ranked if pid in products]
        exact = ordered[0] if ordered and ordered[0][1] >= EXACT_THRESHOLD else None
        similar = [
            (p, s)
            for p, s in ordered
            if s >= SIMILAR_THRESHOLD and (exact is None or p.id != exact[0].id)
        ][:limit]
        if not similar and ordered:
            similar = [(p, s) for p, s in ordered if exact is None or p.id != exact[0].id][
                : min(3, limit)
            ]
        await record_event(
            self.db,
            AnalyticsEventType.VISUAL_SEARCH,
            customer_id=customer_id,
            session_token=session_token,
            product_id=exact[0].id if exact else (similar[0][0].id if similar else None),
            properties={"exact": exact is not None, "results": len(similar)},
        )
        return exact, similar, len(best)
