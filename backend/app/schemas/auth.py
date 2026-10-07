from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import EmailStr, Field, field_validator, model_validator

from app.schemas.common import APIModel

PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


def normalise_phone(value: str) -> str:
    digits = re.sub(r"[\s\-()]", "", value)
    if not PHONE_RE.match(digits):
        raise ValueError("Enter a valid phone number with country code, e.g. +919876543210")
    if not digits.startswith("+"):
        digits = "+91" + digits if len(digits) == 10 else "+" + digits
    return digits


class RegisterRequest(APIModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    marketing_opt_in: bool = False

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalise_phone(v) if v else None

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if v.lower() == v or v.upper() == v or not re.search(r"\d", v):
            raise ValueError(
                "Use at least 8 characters with upper and lower case letters and a number"
            )
        return v

    @model_validator(mode="after")
    def _email_or_phone(self) -> RegisterRequest:
        if not self.email and not self.phone:
            raise ValueError("Provide an email address or a phone number")
        return self


class LoginRequest(APIModel):
    identifier: str = Field(min_length=3, max_length=255, description="Email or phone")
    password: str = Field(min_length=1, max_length=128)


class OtpRequest(APIModel):
    identifier: str = Field(min_length=3, max_length=255, description="Email or phone")


class OtpVerifyRequest(APIModel):
    identifier: str = Field(min_length=3, max_length=255)
    code: str = Field(min_length=4, max_length=8, pattern=r"^\d+$")
    full_name: str | None = Field(default=None, min_length=2, max_length=120)


class ChangePasswordRequest(APIModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strength(cls, v: str) -> str:
        return RegisterRequest._password_strength(v)


class UserOut(APIModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
    roles: list[str]
    is_active: bool
    email_verified: bool
    phone_verified: bool
    created_at: datetime


class CustomerProfileOut(APIModel):
    id: uuid.UUID
    user: UserOut
    date_of_birth: datetime | None = None
    anniversary: datetime | None = None
    gender: str | None = None
    preferred_metal: str | None = None
    preferred_store_id: uuid.UUID | None = None
    ring_size_estimate: str | None = None
    marketing_opt_in: bool
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str


class CustomerProfileUpdate(APIModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    gender: str | None = Field(default=None, max_length=16)
    preferred_metal: str | None = Field(default=None, max_length=32)
    preferred_store_id: uuid.UUID | None = None
    ring_size_estimate: str | None = Field(default=None, max_length=16)
    marketing_opt_in: bool | None = None
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, min_length=2, max_length=2)


class SessionOut(APIModel):
    user: UserOut
    access_expires_at: datetime
