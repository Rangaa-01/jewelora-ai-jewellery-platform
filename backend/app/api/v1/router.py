from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, categories, collections, customers, health, media, products, stores
from app.api.v1.admin import router as admin_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(customers.router)
api_router.include_router(products.router)
api_router.include_router(categories.router)
api_router.include_router(collections.router)
api_router.include_router(stores.router)
api_router.include_router(media.router)
api_router.include_router(admin_router)
