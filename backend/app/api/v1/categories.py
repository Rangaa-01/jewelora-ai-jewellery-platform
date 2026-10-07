from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import DBDep, OptionalUserDep, StorageDep, is_staff
from app.schemas.catalogue import CategoryOut
from app.services.catalogue_service import CatalogueService
from app.services.serializers import category_out

router = APIRouter(prefix="/categories", tags=["catalogue"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: DBDep, storage: StorageDep, user: OptionalUserDep
) -> list[CategoryOut]:
    rows = await CatalogueService(db).list_categories(include_inactive=is_staff(user))
    return [category_out(category, storage, count) for category, count in rows]
