"""FastAPI application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.errors import RateLimitedError, register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import install_middleware
from app.core.rate_limit import limiter
from app.core.settings import Settings, get_settings
from app.db.session import dispose_engine, get_engine

log = get_logger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        get_engine()
        log.info(
            "startup",
            env=settings.app_env,
            storage=settings.storage_backend,
            ai_enabled=settings.ai_enabled,
        )
        yield
        await dispose_engine()
        log.info("shutdown")

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=None if settings.is_production else f"{settings.api_prefix}/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else f"{settings.api_prefix}/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.limiter = limiter

    install_middleware(app, settings)
    register_exception_handlers(app)

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        err = RateLimitedError()
        return JSONResponse(
            status_code=err.status_code, content=err.to_payload(), headers={"Retry-After": "60"}
        )

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
