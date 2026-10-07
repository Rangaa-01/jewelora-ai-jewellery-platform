from __future__ import annotations

from httpx import AsyncClient


async def login(client: AsyncClient, identifier: str, password: str) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"identifier": identifier, "password": password}
    )
    assert response.status_code == 200, response.text


async def register_customer(
    client: AsyncClient, email: str = "priya@example.com", password: str = "Secure#2024"
) -> dict:  # type: ignore[type-arg]
    response = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Priya Raman", "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


def logout(client: AsyncClient) -> None:
    client.cookies.clear()
