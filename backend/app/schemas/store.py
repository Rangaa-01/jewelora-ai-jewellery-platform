from __future__ import annotations

import uuid
from typing import Any

from pydantic import Field

from app.schemas.common import APIModel


class StoreOut(APIModel):
    id: uuid.UUID
    name: str
    slug: str
    address_line1: str
    address_line2: str | None
    city: str
    state: str
    postal_code: str
    country: str
    phone: str | None
    email: str | None
    latitude: float | None
    longitude: float | None
    opening_hours: dict[str, Any] | None
    timezone: str
    appointment_slot_minutes: int
    is_active: bool


class StoreIn(APIModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    address_line1: str = Field(min_length=2, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=3, max_length=20)
    country: str = Field(default="IN", min_length=2, max_length=2)
    phone: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    opening_hours: dict[str, Any] | None = None
    timezone: str = Field(default="Asia/Kolkata", max_length=64)
    appointment_slot_minutes: int = Field(default=30, ge=10, le=240)
    is_active: bool = True
