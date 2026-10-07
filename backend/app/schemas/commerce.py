from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import EmailStr, Field, field_validator, model_validator

from app.models.enums import FulfilmentMethod, PaymentMethod
from app.schemas.auth import normalise_phone
from app.schemas.catalogue import ProductSizeOut, ProductSummaryOut, ProductVariantOut
from app.schemas.common import APIModel


class CartItemIn(APIModel):
    product_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    size_id: uuid.UUID | None = None
    quantity: int = Field(default=1, ge=1, le=10)


class CartItemUpdate(APIModel):
    quantity: int = Field(ge=0, le=10)


class CartItemOut(APIModel):
    id: uuid.UUID
    product: ProductSummaryOut
    variant: ProductVariantOut | None
    size: ProductSizeOut | None
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    available: bool


class CartOut(APIModel):
    id: uuid.UUID
    items: list[CartItemOut]
    subtotal: Decimal
    tax_total: Decimal
    grand_total: Decimal
    currency: str
    item_count: int


class AddressIn(APIModel):
    line1: str = Field(min_length=3, max_length=255)
    line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=3, max_length=20)
    country: str = Field(default="IN", min_length=2, max_length=2)


class OrderIn(APIModel):
    fulfilment_method: FulfilmentMethod = FulfilmentMethod.STORE_PICKUP
    store_id: uuid.UUID | None = None
    payment_method: PaymentMethod = PaymentMethod.PAY_AT_STORE
    contact_name: str = Field(min_length=2, max_length=120)
    contact_phone: str = Field(max_length=20)
    contact_email: EmailStr | None = None
    shipping_address: AddressIn | None = None
    customer_notes: str | None = Field(default=None, max_length=2000)

    @field_validator("contact_phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_phone(v)

    @model_validator(mode="after")
    def _consistency(self) -> OrderIn:
        if self.fulfilment_method == FulfilmentMethod.DELIVERY and self.shipping_address is None:
            raise ValueError("A delivery address is required for home delivery")
        if self.fulfilment_method == FulfilmentMethod.STORE_PICKUP and self.store_id is None:
            raise ValueError("Choose a store for pickup")
        if (
            self.payment_method == PaymentMethod.PAY_AT_STORE
            and self.fulfilment_method != FulfilmentMethod.STORE_PICKUP
        ):
            raise ValueError("Pay at store is only available with store pickup")
        return self


class OrderItemOut(APIModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    sku: str
    name: str
    variant_label: str | None
    size_label: str | None
    image_url: str | None
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class PaymentOut(APIModel):
    id: uuid.UUID
    provider: str
    status: str
    amount: Decimal
    currency: str
    provider_order_id: str | None
    checkout: dict[str, Any] | None = None  # provider client payload (e.g. Razorpay key + order id)


class OrderOut(APIModel):
    id: uuid.UUID
    order_number: str
    status: str
    fulfilment_method: str
    store_id: uuid.UUID | None
    store_name: str | None
    payment_method: str
    currency: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    shipping_total: Decimal
    grand_total: Decimal
    shipping_address: dict[str, Any] | None
    contact_name: str
    contact_phone: str
    contact_email: str | None
    customer_notes: str | None
    items: list[OrderItemOut]
    payment: PaymentOut | None
    placed_at: datetime
    paid_at: datetime | None


class PaymentConfirmIn(APIModel):
    provider_payment_id: str = Field(max_length=128)
    provider_order_id: str = Field(max_length=128)
    signature: str = Field(max_length=256)
