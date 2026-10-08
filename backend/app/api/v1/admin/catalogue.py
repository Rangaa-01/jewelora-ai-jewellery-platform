"""Admin catalogue management: products, assets, categories, collections."""

from __future__ import annotations

import asyncio
import json
import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import DBDep, ManagerUserDep, SettingsDep, StorageDep, require_roles
from app.core.errors import PayloadTooLargeError, ValidationAppError
from app.core.logging import get_logger
from app.core.rate_limit import UPLOAD_LIMIT, limiter
from app.core.settings import Settings
from app.models.catalogue import Product
from app.models.enums import Role
from app.schemas.catalogue import (
    CategoryIn,
    CategoryOut,
    CollectionIn,
    CollectionOut,
    Model3DAssetMetaIn,
    Model3DAssetOut,
    ProductDetailOut,
    ProductFilters,
    ProductImageMetaIn,
    ProductImageOut,
    ProductIn,
    ProductSummaryOut,
    ProductUpdate,
    TryOnAssetMetaIn,
    TryOnAssetOut,
)
from app.schemas.common import Message, Page
from app.services.catalogue_service import CatalogueService
from app.services.serializers import (
    category_out,
    collection_out,
    image_out,
    model_3d_out,
    product_detail_out,
    product_summary_out,
    tryon_asset_out,
)
from app.services.upload_service import process_image, validate_glb
from app.storage import ObjectStorage
from app.storage.base import (
    collection_image_key,
    product_image_key,
    product_model_key,
    product_tryon_asset_key,
)

log = get_logger(__name__)
router = APIRouter(dependencies=[Depends(require_roles(Role.ADMIN, Role.MANAGER))])
FiltersDep = Annotated[ProductFilters, Query()]


def _parse_meta[T: BaseModel](model: type[T], raw: str | None) -> T:
    try:
        return model.model_validate_json(raw or "{}")
    except ValidationError as exc:
        raise ValidationAppError(details=json.loads(exc.json())) from exc


async def _read_upload(file: UploadFile, limit: int) -> bytes:
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise PayloadTooLargeError(f"Files must be smaller than {limit // (1024 * 1024)} MB.")
    return data


# --- products ----------------------------------------------------------------------------


@router.get("/products", response_model=Page[ProductSummaryOut])
async def admin_list_products(
    filters: FiltersDep, db: DBDep, storage: StorageDep
) -> Page[ProductSummaryOut]:
    products, total = await CatalogueService(db).list_products(filters, include_inactive=True)
    return Page(
        items=[product_summary_out(p, storage) for p in products],
        total=total,
        page=filters.page,
        page_size=filters.page_size,
    )


@router.post("/products", response_model=ProductDetailOut, status_code=status.HTTP_201_CREATED)
async def admin_create_product(
    data: ProductIn, db: DBDep, storage: StorageDep, user: ManagerUserDep
) -> ProductDetailOut:
    product = await CatalogueService(db).create_product(data)
    log.info("admin_product_created", product_id=str(product.id), by=str(user.id))
    return product_detail_out(product, storage)


@router.get("/products/{product_id}", response_model=ProductDetailOut)
async def admin_get_product(
    product_id: uuid.UUID, db: DBDep, storage: StorageDep
) -> ProductDetailOut:
    return product_detail_out(await CatalogueService(db).get_product(product_id), storage)


@router.patch("/products/{product_id}", response_model=ProductDetailOut)
async def admin_update_product(
    product_id: uuid.UUID, data: ProductUpdate, db: DBDep, storage: StorageDep, user: ManagerUserDep
) -> ProductDetailOut:
    product = await CatalogueService(db).update_product(product_id, data)
    log.info("admin_product_updated", product_id=str(product.id), by=str(user.id))
    return product_detail_out(product, storage)


class QualityCheckOut(BaseModel):
    key: str
    label: str
    status: str
    detail: str


class QualityReportOut(BaseModel):
    score: int
    tryon_ready: bool
    checks: list[QualityCheckOut]


@router.get("/products/{product_id}/quality", response_model=QualityReportOut)
async def admin_product_quality(
    product_id: uuid.UUID, db: DBDep, storage: StorageDep
) -> QualityReportOut:
    """Asset quality score: photos, try-on cut-out and optional assets, with fixes."""
    from app.services.asset_quality import assess_product

    product = await CatalogueService(db).get_product(product_id)
    report = await assess_product(product, storage)
    return QualityReportOut(
        score=report.score,
        tryon_ready=report.tryon_ready,
        checks=[
            QualityCheckOut(key=c.key, label=c.label, status=c.status, detail=c.detail)
            for c in report.checks
        ],
    )


@router.post("/products/{product_id}/deactivate", response_model=ProductDetailOut)
async def admin_deactivate_product(
    product_id: uuid.UUID, db: DBDep, storage: StorageDep
) -> ProductDetailOut:
    return product_detail_out(await CatalogueService(db).deactivate_product(product_id), storage)


@router.delete(
    "/products/{product_id}",
    response_model=Message,
    dependencies=[Depends(require_roles(Role.ADMIN))],
)
async def admin_delete_product(
    product_id: uuid.UUID, db: DBDep, storage: StorageDep, user: ManagerUserDep
) -> Message:
    service = CatalogueService(db)
    product = await service.get_product(product_id)
    keys = [i.storage_key for i in product.images] + [a.storage_key for a in product.tryon_assets]
    keys += [m.storage_key for m in product.model_3d_assets]
    await service.delete_product(product_id)
    for key in keys:
        await storage.delete(key)
    log.info("admin_product_deleted", product_id=str(product_id), by=str(user.id))
    return Message(message="Product deleted.")


# --- assets ------------------------------------------------------------------------------------


@router.post(
    "/products/{product_id}/images",
    response_model=ProductImageOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(UPLOAD_LIMIT)
async def admin_upload_image(
    request: Request,
    product_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    file: UploadFile = File(...),
    meta: str | None = Form(default=None),
) -> ProductImageOut:
    service = CatalogueService(db)
    product = await service.get_product(product_id)
    parsed = _parse_meta(ProductImageMetaIn, meta)
    data = await _read_upload(file, settings.product_asset_max_bytes)
    processed = process_image(
        data, settings, max_bytes=settings.product_asset_max_bytes, max_dimension=2400
    )
    key = product_image_key(str(product.id), processed.extension)
    await storage.put(key, processed.data, processed.content_type)
    image = await service.add_image(
        product,
        storage_key=key,
        width=processed.width,
        height=processed.height,
        meta=parsed.model_dump(),
    )
    await _reindex_quietly(db, storage, settings, product)
    return image_out(image, storage)


async def _reindex_quietly(
    db: AsyncSession, storage: ObjectStorage, settings: Settings, product: Product
) -> None:
    """Refresh visual-search embeddings after an image change; never fails the request."""
    from app.services.visual_search_service import VisualSearchService

    try:
        await VisualSearchService(db, storage, settings).index_product(product)
    except Exception:
        log.warning("embedding_reindex_skipped", product_id=str(product.id))


@router.delete("/products/{product_id}/images/{image_id}", response_model=Message)
async def admin_delete_image(
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> Message:
    service = CatalogueService(db)
    product = await service.get_product(product_id)
    image = await service.remove_image(product, image_id)
    await storage.delete(image.storage_key)
    await _reindex_quietly(db, storage, settings, product)
    return Message(message="Image removed.")


@router.post(
    "/products/{product_id}/tryon-assets",
    response_model=TryOnAssetOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(UPLOAD_LIMIT)
async def admin_upload_tryon_asset(
    request: Request,
    product_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    file: UploadFile = File(...),
    meta: str | None = Form(default=None),
    auto_cutout: bool = Form(default=False),
    single_piece: bool | None = Form(default=None),
    punch_holes: bool | None = Form(default=None),
) -> TryOnAssetOut:
    """Upload a try-on cut-out.

    With ``auto_cutout=true`` an ordinary product photo is accepted: the background is
    removed automatically and anchors are estimated from the jewellery's outline (any
    anchors supplied in ``meta`` override the estimates). ``single_piece`` keeps only the
    largest piece (pairs, loose stones); ``punch_holes`` re-opens the inside of rings and
    loops that the matting filled with backdrop (automatic on dark backdrops).
    """
    service = CatalogueService(db)
    product = await service.get_product(product_id)
    parsed = _parse_meta(TryOnAssetMetaIn, meta)
    data = await _read_upload(file, settings.product_asset_max_bytes)
    meta_dict = parsed.model_dump()
    if auto_cutout:
        from app.services.cutout_service import CutoutOptions, make_tryon_asset

        options = CutoutOptions(single_piece=single_piece, punch_holes=punch_holes)
        cut = await asyncio.to_thread(
            make_tryon_asset, data, product.jewellery_type, settings, options=options
        )
        data = cut.png
        meta_dict["anchors"] = {**cut.anchors, **(parsed.anchors or {})}
        meta_dict["real_width_mm"] = parsed.real_width_mm or Decimal(str(cut.real_width_mm))
        meta_dict["real_height_mm"] = parsed.real_height_mm or Decimal(str(cut.real_height_mm))
    processed = await asyncio.to_thread(
        process_image,
        data,
        settings,
        max_bytes=settings.product_asset_max_bytes,
        max_dimension=2048,
        keep_alpha=True,
        quality=95,
    )
    if not processed.has_alpha:
        raise ValidationAppError(
            "Try-on assets must be transparent PNG or WebP images (jewellery cut out from "
            "its background). Tick 'auto cut-out' to use a normal photo.",
            code="asset_not_transparent",
        )
    key = product_tryon_asset_key(str(product.id), processed.extension)
    await storage.put(key, processed.data, processed.content_type)
    asset = await service.add_tryon_asset(
        product, storage_key=key, width=processed.width, height=processed.height, meta=meta_dict
    )
    if not product.tryon_enabled:
        product.tryon_enabled = True
    return tryon_asset_out(asset, storage)


@router.delete("/products/{product_id}/tryon-assets/{asset_id}", response_model=Message)
async def admin_delete_tryon_asset(
    product_id: uuid.UUID, asset_id: uuid.UUID, db: DBDep, storage: StorageDep
) -> Message:
    service = CatalogueService(db)
    product = await service.get_product(product_id)
    asset = await service.remove_tryon_asset(product, asset_id)
    await storage.delete(asset.storage_key)
    return Message(message="Try-on asset removed.")


@router.post(
    "/products/{product_id}/models",
    response_model=Model3DAssetOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(UPLOAD_LIMIT)
async def admin_upload_model(
    request: Request,
    product_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    file: UploadFile = File(...),
    meta: str | None = Form(default=None),
) -> Model3DAssetOut:
    service = CatalogueService(db)
    product = await service.get_product(product_id)
    parsed = _parse_meta(Model3DAssetMetaIn, meta)
    data = await _read_upload(file, settings.model_asset_max_bytes)
    size = validate_glb(data, settings)
    key = product_model_key(str(product.id), "glb")
    await storage.put(key, data, "model/gltf-binary")
    asset = await service.add_model_3d(
        product, storage_key=key, size=size, meta=parsed.model_dump()
    )
    return model_3d_out(asset, storage)


@router.delete("/products/{product_id}/models/{asset_id}", response_model=Message)
async def admin_delete_model(
    product_id: uuid.UUID, asset_id: uuid.UUID, db: DBDep, storage: StorageDep
) -> Message:
    service = CatalogueService(db)
    product = await service.get_product(product_id)
    asset = await service.remove_model_3d(product, asset_id)
    await storage.delete(asset.storage_key)
    return Message(message="3D model removed.")


# --- categories & collections ------------------------------------------------------------------


@router.get("/categories", response_model=list[CategoryOut])
async def admin_list_categories(db: DBDep, storage: StorageDep) -> list[CategoryOut]:
    rows = await CatalogueService(db).list_categories(include_inactive=True)
    return [category_out(c, storage, n) for c, n in rows]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def admin_create_category(data: CategoryIn, db: DBDep, storage: StorageDep) -> CategoryOut:
    return category_out(await CatalogueService(db).create_category(data), storage)


@router.patch("/categories/{category_id}", response_model=CategoryOut)
async def admin_update_category(
    category_id: uuid.UUID, data: CategoryIn, db: DBDep, storage: StorageDep
) -> CategoryOut:
    return category_out(await CatalogueService(db).update_category(category_id, data), storage)


@router.get("/collections", response_model=list[CollectionOut])
async def admin_list_collections(db: DBDep, storage: StorageDep) -> list[CollectionOut]:
    rows = await CatalogueService(db).list_collections(include_inactive=True)
    return [collection_out(c, storage, n) for c, n in rows]


@router.post("/collections", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def admin_create_collection(
    data: CollectionIn, db: DBDep, storage: StorageDep
) -> CollectionOut:
    return collection_out(await CatalogueService(db).create_collection(data), storage)


@router.patch("/collections/{collection_id}", response_model=CollectionOut)
async def admin_update_collection(
    collection_id: uuid.UUID, data: CollectionIn, db: DBDep, storage: StorageDep
) -> CollectionOut:
    return collection_out(
        await CatalogueService(db).update_collection(collection_id, data), storage
    )


@router.post("/collections/{collection_id}/hero-image", response_model=CollectionOut)
@limiter.limit(UPLOAD_LIMIT)
async def admin_upload_collection_hero(
    request: Request,
    collection_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    file: UploadFile = File(...),
) -> CollectionOut:
    service = CatalogueService(db)
    collection = await service.get_collection(collection_id)
    data = await _read_upload(file, settings.product_asset_max_bytes)
    processed = process_image(
        data, settings, max_bytes=settings.product_asset_max_bytes, max_dimension=2400
    )
    key = collection_image_key(str(collection.id), processed.extension)
    await storage.put(key, processed.data, processed.content_type)
    old = collection.hero_image_key
    collection.hero_image_key = key
    await db.flush()
    if old:
        await storage.delete(old)
    return collection_out(collection, storage)
