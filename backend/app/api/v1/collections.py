from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.deps import DBDep, OptionalUserDep, StorageDep, is_staff
from app.schemas.catalogue import CollectionOut, ProductFilters, ProductSummaryOut
from app.schemas.common import Page
from app.services.catalogue_service import CatalogueService
from app.services.serializers import collection_out, product_summary_out

router = APIRouter(prefix="/collections", tags=["catalogue"])


@router.get("", response_model=list[CollectionOut])
async def list_collections(
    db: DBDep,
    storage: StorageDep,
    user: OptionalUserDep,
    featured: bool | None = Query(default=None),
    bridal: bool | None = Query(default=None),
) -> list[CollectionOut]:
    service = CatalogueService(db)
    rows = await service.list_collections(
        featured=featured, bridal=bridal, include_inactive=is_staff(user)
    )
    previews = await service.collection_previews([c.id for c, _ in rows])
    return [collection_out(c, storage, n, previews.get(c.id)) for c, n in rows]


@router.get("/{slug}", response_model=CollectionOut)
async def get_collection(
    slug: str, db: DBDep, storage: StorageDep, user: OptionalUserDep
) -> CollectionOut:
    service = CatalogueService(db)
    collection = await service.get_collection_by_slug(slug, include_inactive=is_staff(user))
    counts = {c.id: n for c, n in await service.list_collections(include_inactive=True)}
    previews = await service.collection_previews([collection.id])
    return collection_out(
        collection, storage, counts.get(collection.id, 0), previews.get(collection.id)
    )


@router.get("/{slug}/products", response_model=Page[ProductSummaryOut])
async def collection_products(
    slug: str,
    db: DBDep,
    storage: StorageDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=96),
    sort: str = Query(default="relevance"),
) -> Page[ProductSummaryOut]:
    service = CatalogueService(db)
    await service.get_collection_by_slug(slug)
    filters = ProductFilters(collection=slug, page=page, page_size=page_size, sort=sort)
    products, total = await service.list_products(filters)
    return Page(
        items=[product_summary_out(p, storage) for p in products],
        total=total,
        page=page,
        page_size=page_size,
    )
