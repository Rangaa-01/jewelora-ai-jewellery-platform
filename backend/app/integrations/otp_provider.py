"""OTP delivery providers.

The platform is OTP-ready: codes are generated, hashed and verified by
``AuthService``. Delivery is delegated to an ``OtpProvider``. Until a real SMS/email
gateway is configured (``OTP_ENABLED=true`` and a provider implementation), OTP login is
disabled and the API says so clearly instead of pretending to send a code.
"""

from __future__ import annotations

from typing import Protocol

from app.core.logging import get_logger

log = get_logger(__name__)


class OtpProvider(Protocol):
    channel: str

    async def send(self, identifier: str, code: str) -> None: ...


class LoggingOtpProvider:
    """Development-only provider: writes the code to the server log."""

    channel = "log"

    async def send(self, identifier: str, code: str) -> None:
        log.warning("otp_code_issued_dev_only", identifier=identifier, code=code)


class DisabledOtpProvider:
    channel = "disabled"

    async def send(self, identifier: str, code: str) -> None:
        raise RuntimeError("OTP delivery is not configured")
