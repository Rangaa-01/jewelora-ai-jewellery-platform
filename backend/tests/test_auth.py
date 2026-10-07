from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Role
from tests.factories import make_staff
from tests.helpers import login, logout, register_customer


async def test_register_sets_cookies_and_returns_session(client: AsyncClient) -> None:
    body = await register_customer(client)
    assert body["user"]["roles"] == ["customer"]
    assert body["user"]["email"] == "priya@example.com"
    assert "access_token" in client.cookies and "refresh_token" in client.cookies

    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["full_name"] == "Priya Raman"


async def test_register_rejects_weak_password_and_duplicates(client: AsyncClient) -> None:
    weak = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "A B", "email": "a@b.com", "password": "password"},
    )
    assert weak.status_code == 422
    assert weak.json()["error"]["code"] == "validation_error"
    assert any("password" in d["field"] for d in weak.json()["error"]["details"])

    await register_customer(client, email="dup@example.com")
    logout(client)
    dup = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Dup", "email": "DUP@example.com", "password": "Secure#2024"},
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "email_taken"


async def test_register_with_phone_normalises_number(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Arun K", "phone": "98765 43210", "password": "Secure#2024"},
    )
    assert response.status_code == 201
    assert response.json()["user"]["phone"] == "+919876543210"


async def test_login_logout_flow(client: AsyncClient) -> None:
    await register_customer(client)
    logout(client)
    assert (await client.get("/api/v1/auth/me")).status_code == 401

    bad = await client.post(
        "/api/v1/auth/login", json={"identifier": "priya@example.com", "password": "wrong"}
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"

    await login(client, "priya@example.com", "Secure#2024")
    assert (await client.get("/api/v1/auth/me")).status_code == 200

    out = await client.post("/api/v1/auth/logout")
    assert out.status_code == 200
    # Server cleared the cookies: the client jar should no longer carry a usable access token.
    logout(client)
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_refresh_rotates_and_detects_reuse(client: AsyncClient) -> None:
    await register_customer(client)
    first_refresh = client.cookies["refresh_token"]

    rotated = await client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    second_refresh = client.cookies["refresh_token"]
    assert second_refresh != first_refresh

    # Replaying the old token must fail and revoke the family.
    client.cookies.set("refresh_token", first_refresh)
    replay = await client.post("/api/v1/auth/refresh")
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "session_expired"

    client.cookies.set("refresh_token", second_refresh)
    after = await client.post("/api/v1/auth/refresh")
    assert after.status_code == 401


async def test_account_lockout_after_repeated_failures(client: AsyncClient) -> None:
    await register_customer(client, email="lock@example.com")
    logout(client)
    for _ in range(8):
        await client.post(
            "/api/v1/auth/login", json={"identifier": "lock@example.com", "password": "nope"}
        )
    locked = await client.post(
        "/api/v1/auth/login", json={"identifier": "lock@example.com", "password": "Secure#2024"}
    )
    assert locked.status_code == 401
    assert locked.json()["error"]["code"] == "account_locked"


async def test_change_password_invalidates_other_sessions(client: AsyncClient) -> None:
    await register_customer(client)
    old_access = client.cookies["access_token"]
    response = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Secure#2024", "new_password": "Newer#2025"},
    )
    assert response.status_code == 200
    # The old access token is rejected because token_version changed.
    client.cookies.set("access_token", old_access)
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    logout(client)
    await login(client, "priya@example.com", "Newer#2025")


async def test_otp_is_disabled_until_a_provider_is_configured(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/otp/request", json={"identifier": "+919876543210"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "otp_disabled"


async def test_staff_login_and_role_claims(client: AsyncClient, db: AsyncSession) -> None:
    email, password = await make_staff(db, Role.MANAGER)
    await login(client, email, password)
    me = await client.get("/api/v1/auth/me")
    assert me.json()["user"]["roles"] == ["manager"]


async def test_customer_profile_update(client: AsyncClient) -> None:
    await register_customer(client)
    response = await client.patch(
        "/api/v1/customers/me",
        json={"city": "Chennai", "preferred_metal": "rose_gold", "full_name": "Priya R"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Chennai"
    assert body["user"]["full_name"] == "Priya R"
