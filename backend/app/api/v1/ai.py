"""AI stylist and visual search endpoints."""

from __future__ import annotations

from fastapi import APIRouter, File, Query, Request, Response, UploadFile

from app.core.deps import DBDep, OptionalUserDep, SessionTokenDep, SettingsDep, StorageDep
from app.core.errors import PayloadTooLargeError
from app.core.rate_limit import AI_LIMIT, limiter
from app.schemas.ai import (
    StylistQueryIn,
    StylistRecommendationOut,
    StylistResponseOut,
    VisualMatchOut,
    VisualSearchOut,
)
from app.services.serializers import product_summary_out
from app.services.stylist_service import StylistService
from app.services.upload_service import process_image
from app.services.visual_search_service import VisualSearchService

router = APIRouter(tags=["ai"])


@router.post("/stylist/recommend", response_model=StylistResponseOut)
@limiter.limit(AI_LIMIT)
async def stylist_recommend(
    request: Request,
    data: StylistQueryIn,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> StylistResponseOut:
    customer_id = user.customer.id if user and user.customer else None
    outcome = await StylistService(db, settings).recommend(
        data.query,
        budget_max=data.budget_max,
        occasion=data.occasion,
        limit=data.limit,
        customer_id=customer_id,
        session_token=session_token,
    )
    return StylistResponseOut(
        query=data.query,
        constraints=outcome.constraints.to_out(),
        recommendations=[
            StylistRecommendationOut(
                product=product_summary_out(p, storage), reason=reason, score=round(score, 3)
            )
            for p, reason, score in outcome.picks
        ],
        note=outcome.note,
        llm_used=outcome.llm_used,
    )


@router.post("/visual-search", response_model=VisualSearchOut)
@limiter.limit(AI_LIMIT)
async def visual_search(
    request: Request,
    response: Response,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
    image: UploadFile = File(...),
    limit: int = Query(default=8, ge=1, le=24),
) -> VisualSearchOut:
    data = await image.read(settings.upload_max_bytes + 1)
    if len(data) > settings.upload_max_bytes:
        raise PayloadTooLargeError()
    processed = process_image(data, settings, max_dimension=1024)  # validates + strips metadata
    customer_id = user.customer.id if user and user.customer else None
    exact, similar, indexed = await VisualSearchService(db, storage, settings).search(
        processed.data, limit=limit, customer_id=customer_id, session_token=session_token
    )
    return VisualSearchOut(
        exact=VisualMatchOut(
            product=product_summary_out(exact[0], storage), score=round(exact[1], 3)
        )
        if exact
        else None,
        similar=[
            VisualMatchOut(product=product_summary_out(p, storage), score=round(s, 3))
            for p, s in similar
        ],
        indexed_products=indexed,
    )
