from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.core.deps import CurrentCustomerDep, DBDep, SessionTokenDep, SettingsDep, StorageDep
from app.schemas.common import Message
from app.schemas.engagement import WishlistItemIn, WishlistItemOut, WishlistOut
from app.services.engagement_serializers import wishlist_item_out, wishlist_out
from app.services.engagement_service import WishlistService

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("", response_model=WishlistOut)
async def my_wishlist(
    customer: CurrentCustomerDep, db: DBDep, storage: StorageDep, settings: SettingsDep
) -> WishlistOut:
    return wishlist_out(await WishlistService(db).get_or_create(customer), storage, settings)


@router.post("/items", response_model=WishlistItemOut, status_code=status.HTTP_201_CREATED)
async def add_item(
    data: WishlistItemIn,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    session_token: SessionTokenDep,
) -> WishlistItemOut:
    item = await WishlistService(db).add_item(customer, data, session_token=session_token)
    return wishlist_item_out(item, storage)


@router.delete("/items/{item_id}", response_model=Message)
async def remove_item(item_id: uuid.UUID, customer: CurrentCustomerDep, db: DBDep) -> Message:
    await WishlistService(db).remove_item(customer, item_id)
    return Message(message="Removed from your wishlist.")


@router.post("/share", response_model=WishlistOut)
async def share_wishlist(
    customer: CurrentCustomerDep, db: DBDep, storage: StorageDep, settings: SettingsDep
) -> WishlistOut:
    return wishlist_out(await WishlistService(db).ensure_share_token(customer), storage, settings)


@router.get("/shared/{token}", response_model=WishlistOut)
async def shared_wishlist(
    token: str, db: DBDep, storage: StorageDep, settings: SettingsDep
) -> WishlistOut:
    wishlist = await WishlistService(db).by_share_token(token)
    out = wishlist_out(wishlist, storage, settings)
    out.share_token = None  # viewers can't re-share someone else's list
    out.share_url = None
    return out
