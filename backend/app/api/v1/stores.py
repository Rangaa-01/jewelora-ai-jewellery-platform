from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import DBDep
from app.models.user import Store
from app.schemas.store import StoreOut
from app.services.serializers import store_out

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=list[StoreOut])
async def list_stores(db: DBDep) -> list[StoreOut]:
    stores = (
        (await db.execute(select(Store).where(Store.is_active.is_(True)).order_by(Store.name)))
        .scalars()
        .all()
    )
    return [store_out(s) for s in stores]
