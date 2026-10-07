"""Shared pytest fixtures.

Tests run against a real PostgreSQL database (``TEST_DATABASE_URL``, default
``jewelora_test``). The schema is created from the SQLAlchemy metadata once per session
and every test runs inside a transaction that is rolled back afterwards, so tests are
isolated and fast.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("STORAGE_LOCAL_ROOT", str(Path(__file__).parent / ".storage"))
os.environ.setdefault(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://jewelora:jewelora_dev_password@127.0.0.1:5432/jewelora_test",
)
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]

from app.core.settings import get_settings
from app.db import session as db_session
from app.db.base import Base
from app.main import create_app

CSRF_HEADERS = {"X-Requested-With": "jewelora"}


@pytest.fixture(scope="session")
async def engine():  # type: ignore[no-untyped-def]
    engine = create_async_engine(os.environ["TEST_DATABASE_URL"], poolclass=None)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "INSERT INTO roles (id, name) VALUES "
                "(1,'admin'),(2,'manager'),(3,'sales_staff'),(4,'customer')"
            )
        )
    yield engine
    await engine.dispose()


@pytest.fixture
async def db(engine) -> AsyncIterator[AsyncSession]:  # type: ignore[no-untyped-def]
    """A session bound to a connection whose outer transaction is rolled back."""
    async with engine.connect() as conn:
        trans = await conn.begin()
        factory = async_sessionmaker(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        async with factory() as session:
            yield session
        await trans.rollback()


@pytest.fixture
async def client(db: AsyncSession) -> AsyncIterator[AsyncClient]:
    """HTTP client wired to the app with the DB dependency overridden to the test session."""
    get_settings.cache_clear()
    app = create_app()

    async def _override() -> AsyncIterator[AsyncSession]:
        yield db
        await db.flush()

    app.dependency_overrides[db_session.get_db_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver", headers=CSRF_HEADERS
    ) as ac:
        yield ac
