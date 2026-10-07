"""Photo try-on API."""

from __future__ import annotations

import json
import secrets
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, Query, Request, Response, UploadFile, status
from sqlalchemy import select

from app.core.deps import (
    SESSION_COOKIE,
    DBDep,
    OptionalUserDep,
    SessionTokenDep,
    SettingsDep,
    StorageDep,
)
from app.core.errors import PayloadTooLargeError
from app.core.rate_limit import AI_LIMIT, UPLOAD_LIMIT, limiter
from app.core.settings import Settings
from app.models.tryon import CustomerPhoto, TryOnResult
from app.models.user import Customer, User
from app.schemas.common import Message
from app.schemas.tryon import (
    AdjustmentsIn,
    CustomerPhotoOut,
    PlacementOut,
    RingSizeOut,
    TryOnCapabilitiesOut,
    TryOnItemIn,
    TryOnRerunIn,
    TryOnResultOut,
)
from app.services.tryon_service import (
    SUPPORTED_TYPES,
    EngineRuntime,
    Owner,
    TryOnService,
    parse_items_json,
)
from app.storage import url_for_key

router = APIRouter(prefix="/tryon", tags=["try-on"])


async def resolve_owner(
    request: Request, response: Response, user: User | None, session_token: str | None, db: Any
) -> Owner:
    """Signed-in customers own by customer id; guests get a session cookie."""
    if user is not None:
        customer = user.customer
        if customer is None:
            customer = (
                await db.execute(select(Customer).where(Customer.user_id == user.id))
            ).scalar_one_or_none()
            if customer is None:
                customer = Customer(user_id=user.id)
                db.add(customer)
                await db.flush()
        return Owner(customer_id=customer.id, session_token=session_token)
    if not session_token:
        session_token = secrets.token_urlsafe(24)
        settings: Settings = request.app.state.settings
        response.set_cookie(
            SESSION_COOKIE,
            session_token,
            max_age=30 * 86400,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            path="/",
        )
    return Owner(customer_id=None, session_token=session_token)


def result_out(result: TryOnResult, storage: Any) -> TryOnResultOut:
    placements_blob = result.placements or {}
    placements = [PlacementOut.model_validate(p) for p in placements_blob.get("items", [])]
    ring = placements_blob.get("ring_size_estimate")
    return TryOnResultOut(
        id=result.id,
        session_id=result.session_id,
        photo_id=result.photo_id,
        status=result.status,
        result_url=url_for_key(result.result_storage_key, storage),
        width=result.result_width,
        height=result.result_height,
        confidence=result.confidence,
        warnings=list(result.warnings or []),
        placements=placements,
        detection=placements_blob.get("detection", {}),
        ring_size_estimate=RingSizeOut.model_validate(ring) if ring else None,
        engine_version=result.engine_version,
        processing_ms=result.processing_ms,
        items=[TryOnItemIn.model_validate(i) for i in result.items],
    )


def photo_out(photo: CustomerPhoto, storage: Any) -> CustomerPhotoOut:
    return CustomerPhotoOut(
        id=photo.id,
        url=url_for_key(photo.storage_key, storage) or "",
        width=photo.width,
        height=photo.height,
        detection=photo.detection_summary,
        created_at=photo.created_at.isoformat(),
        expires_at=photo.expires_at.isoformat() if photo.expires_at else None,
    )


@router.get("/capabilities", response_model=TryOnCapabilitiesOut)
async def capabilities(settings: SettingsDep) -> TryOnCapabilitiesOut:
    runtime = EngineRuntime.get(settings)
    return TryOnCapabilitiesOut(
        photo_tryon=runtime.available,
        live_tryon=True,
        supported_types=SUPPORTED_TYPES,
        max_upload_mb=settings.upload_max_bytes // (1024 * 1024),
    )


@router.post("/photo", response_model=TryOnResultOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(UPLOAD_LIMIT)
async def photo_tryon(
    request: Request,
    response: Response,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
    photo: UploadFile = File(...),
    items: str = Form(...),
    mode: str = Form(default="look"),
    device: str | None = Form(default=None),
) -> TryOnResultOut:
    owner = await resolve_owner(request, response, user, session_token, db)
    parsed_items = parse_items_json(items)
    data = await photo.read(settings.upload_max_bytes + 1)
    if len(data) > settings.upload_max_bytes:
        raise PayloadTooLargeError(
            f"Photos must be smaller than {settings.upload_max_bytes // (1024 * 1024)} MB."
        )
    device_info: dict[str, Any] | None = None
    if device and len(device) <= 2000:
        try:
            parsed = json.loads(device)
            device_info = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            device_info = None
    service = TryOnService(db, storage, settings)
    stored = await service.store_photo(owner, data)
    result = await service.run_photo_tryon(
        owner,
        photo=stored,
        items=parsed_items,
        mode="bridal" if mode == "bridal" else "look",
        device_info=device_info,
        user_agent=request.headers.get("user-agent"),
    )
    return result_out(result, storage)


@router.post(
    "/photos/{photo_id}/run", response_model=TryOnResultOut, status_code=status.HTTP_201_CREATED
)
@limiter.limit(AI_LIMIT)
async def rerun_on_photo(
    request: Request,
    response: Response,
    photo_id: uuid.UUID,
    body: TryOnRerunIn,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> TryOnResultOut:
    """Try different pieces on an already-uploaded photo (landmarks are reused)."""
    owner = await resolve_owner(request, response, user, session_token, db)
    service = TryOnService(db, storage, settings)
    photo = await service.get_photo(owner, photo_id)
    result = await service.run_photo_tryon(
        owner, photo=photo, items=body.items, mode=body.mode, device_info=None
    )
    return result_out(result, storage)


@router.get("/results/{result_id}", response_model=TryOnResultOut)
async def get_result(
    request: Request,
    response: Response,
    result_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> TryOnResultOut:
    owner = await resolve_owner(request, response, user, session_token, db)
    result = await TryOnService(db, storage, settings).get_result(owner, result_id)
    return result_out(result, storage)


@router.post(
    "/results/{result_id}/adjust",
    response_model=TryOnResultOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(AI_LIMIT)
async def adjust_result(
    request: Request,
    response: Response,
    result_id: uuid.UUID,
    body: dict[str, AdjustmentsIn],
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> TryOnResultOut:
    """Re-render with manual adjustments keyed by product id."""
    from app.services.tryon_service import apply_adjustments, result_items

    owner = await resolve_owner(request, response, user, session_token, db)
    service = TryOnService(db, storage, settings)
    previous = await service.get_result(owner, result_id)
    items = apply_adjustments(result_items(previous), body)
    result = await service.adjust_result(owner, result_id, items)
    return result_out(result, storage)


@router.get("/photos", response_model=list[CustomerPhotoOut])
async def list_photos(
    request: Request,
    response: Response,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CustomerPhotoOut]:
    owner = await resolve_owner(request, response, user, session_token, db)
    photos = await TryOnService(db, storage, settings).list_photos(owner)
    return [photo_out(p, storage) for p in photos[:limit]]


@router.delete("/photos/{photo_id}", response_model=Message)
async def delete_photo(
    request: Request,
    response: Response,
    photo_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> Message:
    owner = await resolve_owner(request, response, user, session_token, db)
    await TryOnService(db, storage, settings).delete_photo(owner, photo_id)
    return Message(message="Photo deleted.")
