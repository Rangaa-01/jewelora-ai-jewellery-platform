"""HTTP middleware: request ids, timing, security headers and CSRF protection."""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.logging import get_logger
from app.core.settings import Settings, get_settings

log = get_logger("request")

SLOW_REQUEST_MS = 1500
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER = "x-requested-with"
# Routes that legitimately receive browser form posts or provider callbacks without the header.
CSRF_EXEMPT_SUFFIXES = ("/payments/webhook",)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id, path=request.url.path, method=request.method
        )
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Request-ID"] = request_id
        if elapsed_ms > SLOW_REQUEST_MS:
            log.warning(
                "slow_request", duration_ms=round(elapsed_ms, 1), status=response.status_code
            )
        elif request.url.path.endswith("/health") is False:
            log.debug("request", duration_ms=round(elapsed_ms, 1), status=response.status_code)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(self), microphone=(), geolocation=()"
        )
        if get_settings().is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response


class CSRFHeaderMiddleware(BaseHTTPMiddleware):
    """Reject cookie-authenticated state-changing requests that lack the custom header.

    Browsers only attach a custom header to same-origin requests or requests that passed a
    CORS preflight, so a cross-site form post cannot include it. Requests without the
    session cookie are unaffected (they can only act as anonymous callers).
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if (
            request.method in UNSAFE_METHODS
            and any(c in request.cookies for c in ("access_token", "refresh_token", "jw_session"))
            and not request.url.path.endswith(CSRF_EXEMPT_SUFFIXES)
            and request.headers.get(CSRF_HEADER, "").lower() != "jewelora"
        ):
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "csrf_rejected",
                        "message": (
                            "Request blocked for your security. Please refresh and try again."
                        ),
                    }
                },
            )
        return await call_next(request)


def install_middleware(app: FastAPI, settings: Settings) -> None:
    # Order: outermost first. Starlette applies in reverse registration order, so the
    # last-added middleware runs first.
    app.add_middleware(CSRFHeaderMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    if settings.trusted_hosts and settings.trusted_hosts != ["*"]:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
    app.add_middleware(RequestContextMiddleware)
