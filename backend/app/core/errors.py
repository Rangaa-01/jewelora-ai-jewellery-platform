"""Typed application errors and their HTTP rendering.

Services raise ``AppError`` subclasses with a stable machine-readable ``code`` and a
message that is safe to show to customers. Unexpected exceptions are logged with the
request id and rendered as a generic 500 so no technical detail leaks.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

log = get_logger(__name__)


class AppError(Exception):
    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"
    message: str = "The request could not be processed."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: Any = None,
        status_code: int | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.details = details
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)

    def to_payload(self) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details is not None:
            body["details"] = self.details
        return {"error": body}


class ValidationAppError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "validation_error"
    message = "Some of the information provided is not valid."


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "We couldn't find what you were looking for."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    message = "This action conflicts with existing data."


class AuthenticationError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthenticated"
    message = "Please sign in to continue."


class AuthorizationError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"
    message = "You don't have permission to do that."


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "rate_limited"
    message = "Too many requests. Please wait a moment and try again."


class UploadError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_upload"
    message = "We couldn't process that file. Please try another image."


class PayloadTooLargeError(AppError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    code = "payload_too_large"
    message = "That file is too large."


class TryOnError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "tryon_failed"
    message = "We couldn't process your image. Please try another photo."


class ServiceUnavailableError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"
    message = "This feature is temporarily unavailable. Please try again shortly."


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            log.error("app_error", code=exc.code, request_id=_request_id(request), exc_info=exc)
        else:
            log.info(
                "app_error", code=exc.code, status=exc.status_code, request_id=_request_id(request)
            )
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {
                "field": ".".join(str(p) for p in err.get("loc", []) if p != "body"),
                "message": err.get("msg", ""),
            }
            for err in exc.errors()
        ]
        payload = ValidationAppError(details=details).to_payload()
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content=payload)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        mapping = {
            401: AuthenticationError,
            403: AuthorizationError,
            404: NotFoundError,
            405: AppError,
            413: PayloadTooLargeError,
            429: RateLimitedError,
        }
        error_cls = mapping.get(exc.status_code, AppError)
        err = error_cls(status_code=exc.status_code)
        if exc.status_code == 405:
            err.code, err.message = "method_not_allowed", "That action is not supported."
        return JSONResponse(
            status_code=exc.status_code, content=err.to_payload(), headers=dict(exc.headers or {})
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", request_id=_request_id(request), path=request.url.path)
        payload = {
            "error": {
                "code": "internal_error",
                "message": "Something went wrong on our side. Please try again.",
                "request_id": _request_id(request),
            }
        }
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=payload)
