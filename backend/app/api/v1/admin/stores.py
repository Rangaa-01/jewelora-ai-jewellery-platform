from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select

from app.core.deps import DBDep, require_roles
from app.core.errors import ConflictError, NotFoundError
from app.models.enums import Role
from app.models.user import Store
from app.schemas.store import StoreIn, StoreOut
from app.services.serializers import store_out
from app.services.slug import slugify

router = APIRouter(dependencies=[Depends(require_roles(Role.ADMIN, Role.MANAGER))])


@router.get("/stores", response_model=list[StoreOut])
async def admin_list_stores(db: DBDep) -> list[StoreOut]:
    stores = (await db.execute(select(Store).order_by(Store.name))).scalars().all()
    return [store_out(s) for s in stores]


@router.post("/stores", response_model=StoreOut, status_code=status.HTTP_201_CREATED)
async def admin_create_store(data: StoreIn, db: DBDep) -> StoreOut:
    slug = data.slug or slugify(data.name)
    if (await db.execute(select(Store.id).where(Store.slug == slug))).scalar_one_or_none():
        raise ConflictError("A store with this slug already exists.", code="slug_taken")
    store = Store(**data.model_dump(exclude={"slug"}), slug=slug)
    db.add(store)
    await db.flush()
    return store_out(store)


@router.patch("/stores/{store_id}", response_model=StoreOut)
async def admin_update_store(store_id: uuid.UUID, data: StoreIn, db: DBDep) -> StoreOut:
    store = await db.get(Store, store_id)
    if store is None:
        raise NotFoundError(code="store_not_found")
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "slug" and not value:
            continue
        setattr(store, key, value)
    await db.flush()
    return store_out(store)
