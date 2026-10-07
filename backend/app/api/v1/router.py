from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    ai,
    appointments,
    auth,
    cart,
    categories,
    collections,
    customers,
    enquiries,
    health,
    looks,
    media,
    orders,
    products,
    stores,
    tryon,
    wishlist,
)
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
api_router.include_router(tryon.router)
api_router.include_router(wishlist.router)
api_router.include_router(looks.router)
api_router.include_router(appointments.router)
api_router.include_router(enquiries.router)
api_router.include_router(cart.router)
api_router.include_router(orders.router)
api_router.include_router(ai.router)
api_router.include_router(admin_router)
