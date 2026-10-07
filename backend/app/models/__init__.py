"""SQLAlchemy models. Import every model module here so Alembic sees the full metadata."""

from app.db.base import Base
from app.models.analytics import AnalyticsEvent
from app.models.catalogue import (
    Collection,
    MetalRate,
    Product,
    Product3DAsset,
    ProductCategory,
    ProductCollection,
    ProductEmbedding,
    ProductImage,
    ProductSetItem,
    ProductSize,
    ProductTryOnAsset,
    ProductVariant,
)
from app.models.commerce import Cart, CartItem, Order, OrderItem, Payment
from app.models.engagement import (
    Appointment,
    Enquiry,
    SavedLook,
    SavedLookItem,
    StylistRequest,
    Wishlist,
    WishlistItem,
)
from app.models.tryon import CustomerPhoto, TryOnResult, TryOnSession
from app.models.user import Customer, OtpCode, RefreshToken, RoleModel, Store, User, UserRole

__all__ = [
    "AnalyticsEvent",
    "Appointment",
    "Base",
    "Cart",
    "CartItem",
    "Collection",
    "Customer",
    "CustomerPhoto",
    "Enquiry",
    "MetalRate",
    "Order",
    "OrderItem",
    "OtpCode",
    "Payment",
    "Product",
    "Product3DAsset",
    "ProductCategory",
    "ProductCollection",
    "ProductEmbedding",
    "ProductImage",
    "ProductSetItem",
    "ProductSize",
    "ProductTryOnAsset",
    "ProductVariant",
    "RefreshToken",
    "RoleModel",
    "SavedLook",
    "SavedLookItem",
    "Store",
    "StylistRequest",
    "TryOnResult",
    "TryOnSession",
    "User",
    "UserRole",
    "Wishlist",
    "WishlistItem",
]
