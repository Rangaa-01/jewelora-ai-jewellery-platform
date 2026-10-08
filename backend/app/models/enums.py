"""Enumerations shared by models and schemas."""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    SALES_STAFF = "sales_staff"
    CUSTOMER = "customer"


STAFF_ROLES: frozenset[Role] = frozenset({Role.ADMIN, Role.MANAGER, Role.SALES_STAFF})


class JewelleryType(StrEnum):
    """Try-on placement category. Drives which body anchors the AI uses."""

    NECKLACE = "necklace"
    CHAIN = "chain"
    PENDANT = "pendant"
    HARAM = "haram"  # long necklace
    CHOKER = "choker"
    EARRINGS = "earrings"
    RING = "ring"
    BANGLE = "bangle"
    BRACELET = "bracelet"
    NOSE_RING = "nose_ring"
    MAANG_TIKKA = "maang_tikka"
    WAIST_CHAIN = "waist_chain"
    ANKLET = "anklet"
    SET = "set"


class MetalType(StrEnum):
    GOLD = "gold"
    WHITE_GOLD = "white_gold"
    ROSE_GOLD = "rose_gold"
    PLATINUM = "platinum"
    SILVER = "silver"


class StoneType(StrEnum):
    NONE = "none"
    DIAMOND = "diamond"
    RUBY = "ruby"
    EMERALD = "emerald"
    SAPPHIRE = "sapphire"
    PEARL = "pearl"
    POLKI = "polki"
    KUNDAN = "kundan"
    CZ = "cz"


class Gender(StrEnum):
    WOMEN = "women"
    MEN = "men"
    UNISEX = "unisex"
    KIDS = "kids"


class AssetView(StrEnum):
    FRONT = "front"
    LEFT = "left"
    RIGHT = "right"
    TOP = "top"
    BACK = "back"
    ANGLE = "angle"
    DETAIL = "detail"  # close-up of stones, clasp or craftsmanship
    ON_MODEL = "on_model"  # the shop's own photo of a person wearing the piece


class OrderStatus(StrEnum):
    PENDING = "pending"
    AWAITING_PAYMENT = "awaiting_payment"
    PAID = "paid"
    CONFIRMED = "confirmed"
    READY_FOR_PICKUP = "ready_for_pickup"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentStatus(StrEnum):
    CREATED = "created"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(StrEnum):
    PAY_AT_STORE = "pay_at_store"
    RAZORPAY = "razorpay"
    BANK_TRANSFER = "bank_transfer"


class FulfilmentMethod(StrEnum):
    STORE_PICKUP = "store_pickup"
    DELIVERY = "delivery"


class AppointmentStatus(StrEnum):
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class EnquiryStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ContactMethod(StrEnum):
    PHONE = "phone"
    WHATSAPP = "whatsapp"
    EMAIL = "email"


class TryOnMode(StrEnum):
    PHOTO = "photo"
    LIVE = "live"


class TryOnStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalyticsEventType(StrEnum):
    PRODUCT_VIEW = "product_view"
    PRODUCT_TRYON = "product_tryon"
    PRODUCT_WISHLIST = "product_wishlist"
    PRODUCT_SHARE = "product_share"
    PRODUCT_ENQUIRY = "product_enquiry"
    PRODUCT_PURCHASE = "product_purchase"
    PRODUCT_ADD_TO_CART = "product_add_to_cart"
    LOOK_CREATED = "look_created"
    LOOK_SHARED = "look_shared"
    STYLIST_QUERY = "stylist_query"
    VISUAL_SEARCH = "visual_search"
    APPOINTMENT_BOOKED = "appointment_booked"
    SEARCH = "search"
