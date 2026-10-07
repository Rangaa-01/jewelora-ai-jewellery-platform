from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request, Response, status

from app.core.deps import ACCESS_COOKIE, REFRESH_COOKIE, CurrentUserDep, DBDep, SettingsDep
from app.core.errors import AuthenticationError
from app.core.rate_limit import AUTH_LIMIT, OTP_LIMIT, limiter
from app.core.settings import Settings
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    OtpRequest,
    OtpVerifyRequest,
    RegisterRequest,
    SessionOut,
    UserOut,
)
from app.schemas.common import Message
from app.services.auth_service import AuthService, TokenPair

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        roles=user.role_names,
        is_active=user.is_active,
        email_verified=user.email_verified_at is not None,
        phone_verified=user.phone_verified_at is not None,
        created_at=user.created_at,
    )


def set_auth_cookies(response: Response, settings: Settings, pair: TokenPair) -> None:
    for name, value, max_age in (
        (ACCESS_COOKIE, pair.access_token, settings.access_token_minutes * 60),
        (REFRESH_COOKIE, pair.refresh_token, settings.refresh_token_days * 86400),
    ):
        response.set_cookie(
            name,
            value,
            max_age=max_age,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            domain=settings.cookie_domain,
            path="/",
        )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/", domain=settings.cookie_domain)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    return request.headers.get("user-agent"), request.client.host if request.client else None


def _session(user: User, pair: TokenPair) -> SessionOut:
    return SessionOut(user=user_out(user), access_expires_at=pair.access_expires_at)


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=SessionOut)
@limiter.limit(AUTH_LIMIT)
async def register(
    request: Request, response: Response, data: RegisterRequest, db: DBDep, settings: SettingsDep
) -> SessionOut:
    service = AuthService(db, settings)
    user = await service.register_customer(data)
    ua, ip = _client_meta(request)
    pair = await service.issue_tokens(user, user_agent=ua, ip=ip)
    set_auth_cookies(response, settings, pair)
    return _session(user, pair)


@router.post("/login", response_model=SessionOut)
@limiter.limit(AUTH_LIMIT)
async def login(
    request: Request, response: Response, data: LoginRequest, db: DBDep, settings: SettingsDep
) -> SessionOut:
    service = AuthService(db, settings)
    user = await service.authenticate(data.identifier, data.password)
    ua, ip = _client_meta(request)
    pair = await service.issue_tokens(user, user_agent=ua, ip=ip)
    set_auth_cookies(response, settings, pair)
    return _session(user, pair)


@router.post("/refresh", response_model=SessionOut)
@limiter.limit("60/minute")
async def refresh(
    request: Request, response: Response, db: DBDep, settings: SettingsDep
) -> SessionOut:
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise AuthenticationError(
            "Your session has expired. Please sign in again.", code="session_expired"
        )
    service = AuthService(db, settings)
    ua, ip = _client_meta(request)
    try:
        user, pair = await service.rotate_refresh_token(raw, user_agent=ua, ip=ip)
    except AuthenticationError:
        clear_auth_cookies(response, settings)
        raise
    set_auth_cookies(response, settings, pair)
    return _session(user, pair)


@router.post("/logout", response_model=Message)
async def logout(request: Request, response: Response, db: DBDep, settings: SettingsDep) -> Message:
    await AuthService(db, settings).revoke_refresh_token(request.cookies.get(REFRESH_COOKIE))
    clear_auth_cookies(response, settings)
    return Message(message="Signed out.")


@router.post("/logout-all", response_model=Message)
async def logout_all(
    response: Response, user: CurrentUserDep, db: DBDep, settings: SettingsDep
) -> Message:
    await AuthService(db, settings).revoke_all_sessions(user)
    clear_auth_cookies(response, settings)
    return Message(message="Signed out of all devices.")


@router.get("/me", response_model=SessionOut)
async def me(request: Request, user: CurrentUserDep, settings: SettingsDep) -> SessionOut:
    # Access expiry is not stored; report a conservative estimate for the client scheduler.
    return SessionOut(
        user=user_out(user),
        access_expires_at=datetime.now(UTC) + timedelta(minutes=settings.access_token_minutes),
    )


@router.post("/change-password", response_model=Message)
@limiter.limit(AUTH_LIMIT)
async def change_password(
    request: Request,
    response: Response,
    data: ChangePasswordRequest,
    user: CurrentUserDep,
    db: DBDep,
    settings: SettingsDep,
) -> Message:
    service = AuthService(db, settings)
    await service.change_password(user, data.current_password, data.new_password)
    ua, ip = _client_meta(request)
    pair = await service.issue_tokens(user, user_agent=ua, ip=ip)
    set_auth_cookies(response, settings, pair)
    return Message(message="Password updated. Other devices have been signed out.")


@router.post("/otp/request", response_model=Message)
@limiter.limit(OTP_LIMIT)
async def otp_request(
    request: Request, data: OtpRequest, db: DBDep, settings: SettingsDep
) -> Message:
    await AuthService(db, settings).request_otp(data.identifier)
    return Message(message="If that contact is valid, a one-time code is on its way.")


@router.post("/otp/verify", response_model=SessionOut)
@limiter.limit(OTP_LIMIT)
async def otp_verify(
    request: Request, response: Response, data: OtpVerifyRequest, db: DBDep, settings: SettingsDep
) -> SessionOut:
    service = AuthService(db, settings)
    user = await service.verify_otp(data.identifier, data.code, data.full_name)
    ua, ip = _client_meta(request)
    pair = await service.issue_tokens(user, user_agent=ua, ip=ip)
    set_auth_cookies(response, settings, pair)
    return _session(user, pair)
