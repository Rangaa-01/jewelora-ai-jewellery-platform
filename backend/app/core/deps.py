"""FastAPI dependencies for settings, storage, authentication and authorisation."""

from __future__ import annotations

import uuid
from collections.abc import Callable, Coroutine
from typing import Annotated, Any

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthenticationError, AuthorizationError
from app.core.security import decode_access_token
from app.core.settings import Settings, get_settings
from app.db.session import get_db_session
from app.models.enums import STAFF_ROLES, Role
from app.models.user import Customer, User
from app.storage import ObjectStorage, get_storage

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
SESSION_COOKIE = "jw_session"  # anonymous session token for carts / try-on photos

SettingsDep = Annotated[Settings, Depends(get_settings)]
DBDep = Annotated[AsyncSession, Depends(get_db_session)]
StorageDep = Annotated[ObjectStorage, Depends(get_storage)]


def _extract_token(request: Request) -> str | None:
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        return token
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def get_optional_user(request: Request, db: DBDep, settings: SettingsDep) -> User | None:
    token = _extract_token(request)
    if not token:
        return None
    try:
        payload = decode_access_token(settings, token)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None
    user = await db.get(User, user_id)
    if user is None or not user.is_active or user.token_version != payload.get("ver"):
        return None
    request.state.user_id = str(user.id)
    return user


OptionalUserDep = Annotated[User | None, Depends(get_optional_user)]


async def get_current_user(user: OptionalUserDep) -> User:
    if user is None:
        raise AuthenticationError()
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[..., Coroutine[Any, Any, User]]:
    allowed = {r.value for r in roles}

    async def _dependency(user: CurrentUserDep) -> User:
        if not allowed.intersection(user.role_names):
            raise AuthorizationError()
        return user

    return _dependency


require_staff = require_roles(*STAFF_ROLES)
require_admin = require_roles(Role.ADMIN)
require_manager = require_roles(Role.ADMIN, Role.MANAGER)

StaffUserDep = Annotated[User, Depends(require_staff)]
AdminUserDep = Annotated[User, Depends(require_admin)]
ManagerUserDep = Annotated[User, Depends(require_manager)]


async def get_current_customer(user: CurrentUserDep, db: DBDep) -> Customer:
    """The customer profile of the signed-in user, created lazily for staff who shop."""
    if user.customer is not None:
        return user.customer
    customer = (
        await db.execute(select(Customer).where(Customer.user_id == user.id))
    ).scalar_one_or_none()
    if customer is None:
        customer = Customer(user_id=user.id)
        db.add(customer)
        await db.flush()
    return customer


CurrentCustomerDep = Annotated[Customer, Depends(get_current_customer)]


def get_session_token(request: Request) -> str | None:
    """Anonymous session identifier (set by the frontend proxy / auth router)."""
    token = request.cookies.get(SESSION_COOKIE)
    if token and 16 <= len(token) <= 64 and token.replace("-", "").replace("_", "").isalnum():
        return token
    return None


SessionTokenDep = Annotated[str | None, Depends(get_session_token)]


def is_staff(user: User | None) -> bool:
    return bool(user and set(user.role_names) & {r.value for r in STAFF_ROLES})
