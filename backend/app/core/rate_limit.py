"""Rate limiting built on slowapi.

Limits are keyed by authenticated user id when present, otherwise by client IP. The
``X-Forwarded-For`` header is honoured only when the app runs behind the bundled nginx
(``TRUSTED_HOSTS`` configured) because uvicorn is started with ``--proxy-headers``.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.settings import get_settings


def _key_func(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return f"ip:{get_remote_address(request)}"


_settings = get_settings()

limiter = Limiter(
    key_func=_key_func,
    enabled=_settings.rate_limit_enabled,
    storage_uri=_settings.redis_url or "memory://",
    headers_enabled=False,  # header injection requires a Response param on every limited route
    default_limits=["600/minute"],
)

# Named policies reused by routers.
AUTH_LIMIT = "10/minute"
OTP_LIMIT = "5/minute"
UPLOAD_LIMIT = "20/minute"
AI_LIMIT = "30/minute"
PUBLIC_FORM_LIMIT = "10/minute"
SEARCH_LIMIT = "120/minute"

__all__ = [
    "AI_LIMIT",
    "AUTH_LIMIT",
    "OTP_LIMIT",
    "PUBLIC_FORM_LIMIT",
    "SEARCH_LIMIT",
    "UPLOAD_LIMIT",
    "RateLimitExceeded",
    "limiter",
]
