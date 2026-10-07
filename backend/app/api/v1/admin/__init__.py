from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.admin import catalogue as admin_catalogue
from app.api.v1.admin import operations as admin_operations
from app.api.v1.admin import stores as admin_stores

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(admin_catalogue.router)
router.include_router(admin_stores.router)
router.include_router(admin_operations.router)
