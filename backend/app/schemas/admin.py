from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import Field

from app.models.enums import AppointmentStatus, EnquiryStatus, OrderStatus, Role
from app.schemas.auth import UserOut
from app.schemas.common import APIModel


class AdminCustomerOut(APIModel):
    id: uuid.UUID
    user: UserOut
    city: str | None
    state: str | None
    preferred_metal: str | None
    marketing_opt_in: bool
    orders_count: int
    appointments_count: int
    enquiries_count: int
    looks_count: int
    wishlist_count: int
    last_login_at: datetime | None
    created_at: datetime


class AdminCustomerDetailOut(AdminCustomerOut):
    notes: str | None
    phone_verified: bool
    email_verified: bool


class AdminCustomerUpdate(APIModel):
    notes: str | None = Field(default=None, max_length=4000)
    is_active: bool | None = None


class AdminStaffIn(APIModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    roles: list[Role] = Field(min_length=1)


class AdminOrderUpdate(APIModel):
    status: OrderStatus | None = None
    staff_notes: str | None = Field(default=None, max_length=4000)
    mark_paid: bool = False


class AdminEnquiryUpdate(APIModel):
    status: EnquiryStatus | None = None
    staff_notes: str | None = Field(default=None, max_length=4000)
    assigned_staff_id: uuid.UUID | None = None


class AdminAppointmentUpdate(APIModel):
    status: AppointmentStatus | None = None
    staff_notes: str | None = Field(default=None, max_length=4000)
    assigned_staff_id: uuid.UUID | None = None


class ProductStatOut(APIModel):
    product_id: uuid.UUID
    name: str
    slug: str
    image_url: str | None
    count: int


class TimeseriesPointOut(APIModel):
    date: str
    count: int


class AnalyticsOverviewOut(APIModel):
    range_days: int
    totals: dict[str, int]
    revenue: dict[str, Decimal]
    most_tried: list[ProductStatOut]
    most_viewed: list[ProductStatOut]
    most_wishlisted: list[ProductStatOut]
    most_shared: list[ProductStatOut]
    most_enquired: list[ProductStatOut]
    most_purchased: list[ProductStatOut]
    tryons_per_day: list[TimeseriesPointOut]
    orders_per_day: list[TimeseriesPointOut]
    stylist_queries: int
    visual_searches: int
    extra: dict[str, Any] = Field(default_factory=dict)
