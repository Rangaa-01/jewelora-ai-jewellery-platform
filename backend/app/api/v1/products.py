from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.core.deps import DBDep, OptionalUserDep, SessionTokenDep, StorageDep, is_staff
from app.core.rate_limit import SEARCH_LIMIT, limiter
from app.models.enums import AnalyticsEventType
from app.schemas.catalogue import ProductDetailOut, ProductFilters, ProductSummaryOut
from app.schemas.common import Page
from app.services.analytics_service import record_event
from app.services.catalogue_service import CatalogueService
from app.services.serializers import product_detail_out, product_summary_out

router = APIRouter(prefix="/products", tags=["catalogue"])

FiltersDep = Annotated[ProductFilters, Query()]


@router.get("", response_model=Page[ProductSummaryOut], summary="Browse and search the catalogue")
@limiter.limit(SEARCH_LIMIT)
async def list_products(
    request: Request, filters: FiltersDep, db: DBDep, storage: StorageDep, user: OptionalUserDep
) -> Page[ProductSummaryOut]:
    include_inactive = filters.include_inactive and is_staff(user)
    products, total = await CatalogueService(db).list_products(
        filters, include_inactive=include_inactive
    )
    return Page(
        items=[product_summary_out(p, storage) for p in products],
        total=total,
        page=filters.page,
        page_size=filters.page_size,
    )


@router.get("/{slug}", response_model=ProductDetailOut, summary="Product detail by slug")
async def get_product(
    slug: str, db: DBDep, storage: StorageDep, user: OptionalUserDep, session_token: SessionTokenDep
) -> ProductDetailOut:
    service = CatalogueService(db)
    product = await service.get_product_by_slug(slug, include_inactive=is_staff(user))
    if not is_staff(user):
        await service.record_view(product)
        await record_event(
            db,
            AnalyticsEventType.PRODUCT_VIEW,
            product_id=product.id,
            customer_id=user.customer.id if user and user.customer else None,
            session_token=session_token,
        )
    return product_detail_out(product, storage)


@router.get("/{slug}/related", response_model=list[ProductSummaryOut], summary="Related pieces")
async def related_products(
    slug: str, db: DBDep, storage: StorageDep, limit: int = Query(default=8, ge=1, le=24)
) -> list[ProductSummaryOut]:
    service = CatalogueService(db)
    product = await service.get_product_by_slug(slug)
    filters = ProductFilters(category=product.category.slug, page_size=limit + 1, sort="popular")
    candidates, _ = await service.list_products(filters)
    related = [p for p in candidates if p.id != product.id][:limit]
    return [product_summary_out(p, storage) for p in related]
