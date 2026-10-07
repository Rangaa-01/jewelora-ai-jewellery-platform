from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, Request, status

from app.core.deps import CurrentCustomerDep, DBDep, SessionTokenDep, SettingsDep, StorageDep
from app.schemas.common import Message
from app.schemas.engagement import PublicLookOut, SavedLookIn, SavedLookOut, SavedLookUpdate
from app.services.engagement_serializers import look_out, public_look_out
from app.services.engagement_service import LookService

router = APIRouter(prefix="/looks", tags=["looks"])


@router.get("", response_model=list[SavedLookOut])
async def my_looks(
    customer: CurrentCustomerDep, db: DBDep, storage: StorageDep, settings: SettingsDep
) -> list[SavedLookOut]:
    return [look_out(look, storage, settings) for look in await LookService(db).list_mine(customer)]


@router.post("", response_model=SavedLookOut, status_code=status.HTTP_201_CREATED)
async def create_look(
    data: SavedLookIn,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    session_token: SessionTokenDep,
) -> SavedLookOut:
    look = await LookService(db).create(customer, data, session_token=session_token)
    return look_out(look, storage, settings)


@router.get("/public", response_model=list[PublicLookOut])
async def public_looks(
    db: DBDep, storage: StorageDep, limit: int = Query(default=6, ge=1, le=24)
) -> list[PublicLookOut]:
    return [public_look_out(look, storage) for look in await LookService(db).public_feed(limit)]


@router.get("/shared/{token}", response_model=PublicLookOut)
async def shared_look(token: str, db: DBDep, storage: StorageDep) -> PublicLookOut:
    return public_look_out(await LookService(db).by_token(token), storage)


@router.get("/{look_id}", response_model=SavedLookOut)
async def get_look(
    look_id: uuid.UUID,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> SavedLookOut:
    return look_out(await LookService(db).get_mine(customer, look_id), storage, settings)


@router.patch("/{look_id}", response_model=SavedLookOut)
async def update_look(
    look_id: uuid.UUID,
    data: SavedLookUpdate,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> SavedLookOut:
    return look_out(await LookService(db).update(customer, look_id, data), storage, settings)


@router.post("/{look_id}/share", response_model=SavedLookOut)
async def share_look(
    request: Request,
    look_id: uuid.UUID,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> SavedLookOut:
    channel = request.query_params.get("channel")
    return look_out(
        await LookService(db).share(customer, look_id, channel=channel), storage, settings
    )


@router.delete("/{look_id}", response_model=Message)
async def delete_look(look_id: uuid.UUID, customer: CurrentCustomerDep, db: DBDep) -> Message:
    await LookService(db).delete(customer, look_id)
    return Message(message="Look deleted.")
