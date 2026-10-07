"""Authentication use-cases: registration, password login, refresh rotation, OTP."""

from __future__ import annotations

import contextlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    AppError,
    AuthenticationError,
    ConflictError,
    ServiceUnavailableError,
    ValidationAppError,
)
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    generate_numeric_code,
    generate_opaque_token,
    hash_password,
    hash_token,
    password_needs_rehash,
    verify_password,
)
from app.core.settings import Settings
from app.integrations.otp_provider import DisabledOtpProvider, LoggingOtpProvider, OtpProvider
from app.models.enums import Role
from app.models.user import Customer, OtpCode, RefreshToken, RoleModel, User
from app.schemas.auth import RegisterRequest, normalise_phone

log = get_logger(__name__)

MAX_FAILED_ATTEMPTS = 8
LOCKOUT_MINUTES = 15


@dataclass
class TokenPair:
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime


class AuthService:
    def __init__(
        self, db: AsyncSession, settings: Settings, otp_provider: OtpProvider | None = None
    ) -> None:
        self.db = db
        self.settings = settings
        if otp_provider is not None:
            self.otp_provider = otp_provider
        elif settings.otp_enabled and not settings.is_production:
            self.otp_provider = LoggingOtpProvider()
        else:
            self.otp_provider = DisabledOtpProvider()

    # --- helpers -------------------------------------------------------------------

    async def _role(self, role: Role) -> RoleModel:
        result = await self.db.execute(select(RoleModel).where(RoleModel.name == role.value))
        return result.scalar_one()

    async def find_by_identifier(self, identifier: str) -> User | None:
        identifier = identifier.strip()
        conditions = [User.email == identifier]
        with contextlib.suppress(ValueError):
            conditions.append(User.phone == normalise_phone(identifier))
        result = await self.db.execute(select(User).where(or_(*conditions)))
        return result.scalar_one_or_none()

    async def issue_tokens(
        self,
        user: User,
        *,
        user_agent: str | None,
        ip: str | None,
        family_id: uuid.UUID | None = None,
    ) -> TokenPair:
        now = datetime.now(UTC)
        access = create_access_token(
            self.settings, user_id=user.id, roles=user.role_names, token_version=user.token_version
        )
        refresh = generate_opaque_token()
        refresh_expires = now + timedelta(days=self.settings.refresh_token_days)
        self.db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh),
                family_id=family_id or uuid.uuid4(),
                created_at=now,
                expires_at=refresh_expires,
                user_agent=(user_agent or "")[:255] or None,
                ip_address=(ip or "")[:45] or None,
            )
        )
        await self.db.flush()
        return TokenPair(
            access_token=access,
            access_expires_at=now + timedelta(minutes=self.settings.access_token_minutes),
            refresh_token=refresh,
            refresh_expires_at=refresh_expires,
        )

    # --- registration / login ----------------------------------------------------

    async def register_customer(self, data: RegisterRequest) -> User:
        if data.email and await self.find_by_identifier(data.email):
            raise ConflictError("An account with this email already exists.", code="email_taken")
        if data.phone and await self.find_by_identifier(data.phone):
            raise ConflictError(
                "An account with this phone number already exists.", code="phone_taken"
            )
        user = User(
            email=str(data.email).lower() if data.email else None,
            phone=data.phone,
            full_name=data.full_name,
            password_hash=hash_password(data.password),
        )
        user.roles.append(await self._role(Role.CUSTOMER))
        user.customer = Customer(marketing_opt_in=data.marketing_opt_in)
        self.db.add(user)
        await self.db.flush()
        log.info("customer_registered", user_id=str(user.id))
        return user

    async def create_staff_user(
        self,
        *,
        full_name: str,
        email: str,
        password: str,
        roles: list[Role],
        phone: str | None = None,
    ) -> User:
        if await self.find_by_identifier(email):
            raise ConflictError("An account with this email already exists.", code="email_taken")
        user = User(
            email=email.lower(),
            phone=phone,
            full_name=full_name,
            password_hash=hash_password(password),
        )
        for role in roles:
            user.roles.append(await self._role(role))
        self.db.add(user)
        await self.db.flush()
        return user

    async def authenticate(self, identifier: str, password: str) -> User:
        user = await self.find_by_identifier(identifier)
        generic = AuthenticationError(
            "The email/phone or password is incorrect.", code="invalid_credentials"
        )
        if user is None or not user.password_hash:
            # Burn comparable time so account enumeration via timing is harder.
            verify_password(password, hash_password("timing-equaliser"))
            raise generic
        now = datetime.now(UTC)
        if user.locked_until and user.locked_until > now:
            raise AuthenticationError(
                "Too many failed attempts. Please try again in a few minutes.",
                code="account_locked",
            )
        if not user.is_active:
            raise AuthenticationError("This account has been deactivated.", code="account_disabled")
        if not verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
                log.warning("account_locked", user_id=str(user.id))
            await self.db.flush()
            log.info("login_failed", user_id=str(user.id))
            raise generic
        if password_needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        await self.db.flush()
        log.info("login_succeeded", user_id=str(user.id))
        return user

    # --- refresh / logout ------------------------------------------------------------

    async def rotate_refresh_token(
        self, raw_token: str, *, user_agent: str | None, ip: str | None
    ) -> tuple[User, TokenPair]:
        token_hash = hash_token(raw_token)
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()
        now = datetime.now(UTC)
        if stored is None:
            raise AuthenticationError(
                "Your session has expired. Please sign in again.", code="session_expired"
            )
        if stored.revoked_at is not None:
            # Reuse of a rotated token: assume theft and revoke the whole family.
            await self.db.execute(
                update(RefreshToken)
                .where(
                    RefreshToken.family_id == stored.family_id, RefreshToken.revoked_at.is_(None)
                )
                .values(revoked_at=now)
            )
            log.warning(
                "refresh_token_reuse_detected",
                user_id=str(stored.user_id),
                family=str(stored.family_id),
            )
            raise AuthenticationError(
                "Your session has expired. Please sign in again.", code="session_expired"
            )
        if stored.expires_at <= now:
            raise AuthenticationError(
                "Your session has expired. Please sign in again.", code="session_expired"
            )
        user = await self.db.get(User, stored.user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("This account has been deactivated.", code="account_disabled")
        pair = await self.issue_tokens(
            user, user_agent=user_agent, ip=ip, family_id=stored.family_id
        )
        stored.revoked_at = now
        stored.replaced_by_hash = hash_token(pair.refresh_token)
        await self.db.flush()
        return user, pair

    async def revoke_refresh_token(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        await self.db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.token_hash == hash_token(raw_token), RefreshToken.revoked_at.is_(None)
            )
            .values(revoked_at=datetime.now(UTC))
        )

    async def revoke_all_sessions(self, user: User) -> None:
        user.token_version += 1
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
        await self.db.flush()

    async def change_password(self, user: User, current_password: str, new_password: str) -> None:
        if not user.password_hash or not verify_password(current_password, user.password_hash):
            raise ValidationAppError(
                "Your current password is incorrect.", code="invalid_current_password"
            )
        user.password_hash = hash_password(new_password)
        await self.revoke_all_sessions(user)

    # --- OTP ---------------------------------------------------------------------------

    def _otp_available(self) -> None:
        if not self.settings.otp_enabled or isinstance(self.otp_provider, DisabledOtpProvider):
            raise ServiceUnavailableError(
                "One-time code sign-in is not available yet. Please use your password.",
                code="otp_disabled",
            )

    async def request_otp(self, identifier: str) -> None:
        self._otp_available()
        identifier = identifier.strip().lower()
        channel = "email" if "@" in identifier else "sms"
        if channel == "sms":
            identifier = normalise_phone(identifier)
        code = generate_numeric_code(6)
        now = datetime.now(UTC)
        self.db.add(
            OtpCode(
                identifier=identifier,
                channel=channel,
                code_hash=hash_token(code),
                created_at=now,
                expires_at=now + timedelta(minutes=self.settings.otp_ttl_minutes),
            )
        )
        await self.db.flush()
        await self.otp_provider.send(identifier, code)

    async def verify_otp(self, identifier: str, code: str, full_name: str | None) -> User:
        self._otp_available()
        identifier = identifier.strip().lower()
        if "@" not in identifier:
            identifier = normalise_phone(identifier)
        now = datetime.now(UTC)
        result = await self.db.execute(
            select(OtpCode)
            .where(
                OtpCode.identifier == identifier,
                OtpCode.consumed_at.is_(None),
                OtpCode.expires_at > now,
            )
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
        otp = result.scalar_one_or_none()
        invalid = AuthenticationError("That code is incorrect or has expired.", code="invalid_otp")
        if otp is None:
            raise invalid
        if otp.attempts >= self.settings.otp_max_attempts:
            otp.consumed_at = now
            raise invalid
        if otp.code_hash != hash_token(code):
            otp.attempts += 1
            await self.db.flush()
            raise invalid
        otp.consumed_at = now
        user = await self.find_by_identifier(identifier)
        if user is None:
            if not full_name:
                raise AppError("Tell us your name to create your account.", code="name_required")
            user = User(
                email=identifier if "@" in identifier else None,
                phone=identifier if "@" not in identifier else None,
                full_name=full_name,
            )
            user.roles.append(await self._role(Role.CUSTOMER))
            user.customer = Customer()
            self.db.add(user)
            await self.db.flush()
        if "@" in identifier:
            user.email_verified_at = user.email_verified_at or now
        else:
            user.phone_verified_at = user.phone_verified_at or now
        user.last_login_at = now
        await self.db.flush()
        await self.db.refresh(user)
        return user
