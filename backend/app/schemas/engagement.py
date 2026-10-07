from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import EmailStr, Field, field_validator

from app.models.enums import ContactMethod
from app.schemas.auth import normalise_phone
from app.schemas.catalogue import ProductSummaryOut
from app.schemas.common import APIModel
from app.schemas.store import StoreOut
from app.schemas.tryon import AdjustmentsIn

# --- wishlist ----------------------------------------------------------------------------


class WishlistItemIn(APIModel):
    product_id: uuid.UUID | None = None
    variant_id: uuid.UUID | None = None
    saved_look_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=255)


class WishlistItemOut(APIModel):
    id: uuid.UUID
    product: ProductSummaryOut | None
    variant_id: uuid.UUID | None
    saved_look_id: uuid.UUID | None
    note: str | None
    created_at: datetime


class WishlistOut(APIModel):
    id: uuid.UUID
    name: str
    items: list[WishlistItemOut]
    share_token: str | None
    share_url: str | None


# --- saved looks ----------------------------------------------------------------------------


class SavedLookItemIn(APIModel):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    size_id: uuid.UUID | None = None
    slot: str = Field(default="default", max_length=32, pattern=r"^[a-z_]+$")
    adjustments: AdjustmentsIn | None = None


class SavedLookIn(APIModel):
    title: str = Field(min_length=1, max_length=120)
    kind: str = Field(default="look", pattern=r"^(look|bridal)$")
    tryon_result_id: uuid.UUID | None = None
    items: list[SavedLookItemIn] = Field(min_length=1, max_length=12)
    notes: str | None = Field(default=None, max_length=2000)
    is_public: bool = False


class SavedLookUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)
    is_public: bool | None = None


class SavedLookItemOut(APIModel):
    id: uuid.UUID
    product: ProductSummaryOut
    variant_id: uuid.UUID | None
    size_id: uuid.UUID | None
    slot: str
    adjustments: dict[str, Any] | None


class SavedLookOut(APIModel):
    id: uuid.UUID
    title: str
    kind: str
    preview_url: str | None
    tryon_result_id: uuid.UUID | None
    items: list[SavedLookItemOut]
    total_price: str
    is_public: bool
    share_token: str | None
    share_url: str | None
    share_count: int
    notes: str | None
    created_at: datetime


class PublicLookOut(APIModel):
    """What strangers see on a shared look page: no customer identity, no private photo URL."""

    token: str
    title: str
    kind: str
    preview_url: str | None
    items: list[SavedLookItemOut]
    total_price: str
    created_at: datetime


# --- appointments ------------------------------------------------------------------------------


class AppointmentIn(APIModel):
    store_id: uuid.UUID
    starts_at: datetime
    guest_name: str = Field(min_length=2, max_length=120)
    guest_phone: str = Field(max_length=20)
    guest_email: EmailStr | None = None
    party_size: int = Field(default=1, ge=1, le=12)
    purpose: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=2000)
    product_slugs: list[str] = Field(default_factory=list, max_length=20)
    product_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    look_token: str | None = Field(default=None, max_length=32)
    saved_look_id: uuid.UUID | None = None

    @field_validator("guest_phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_phone(v)


class AppointmentOut(APIModel):
    id: uuid.UUID
    reference: str
    store: StoreOut
    starts_at: datetime
    ends_at: datetime
    guest_name: str
    guest_phone: str
    guest_email: str | None
    party_size: int
    purpose: str | None
    notes: str | None
    status: str
    products: list[ProductSummaryOut]
    saved_look_id: uuid.UUID | None
    created_at: datetime


class AppointmentSlotOut(APIModel):
    starts_at: datetime
    ends_at: datetime
    available: bool


# --- enquiries ------------------------------------------------------------------------------------


class EnquiryIn(APIModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(max_length=20)
    email: EmailStr | None = None
    product_id: uuid.UUID | None = None
    product_slug: str | None = Field(default=None, max_length=180)
    saved_look_id: uuid.UUID | None = None
    look_token: str | None = Field(default=None, max_length=32)
    message: str = Field(min_length=5, max_length=4000)
    preferred_contact: ContactMethod = ContactMethod.PHONE

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_phone(v)


class EnquiryOut(APIModel):
    id: uuid.UUID
    reference: str
    name: str
    phone: str
    email: str | None
    product: ProductSummaryOut | None
    saved_look_id: uuid.UUID | None
    message: str
    preferred_contact: str
    status: str
    created_at: datetime
