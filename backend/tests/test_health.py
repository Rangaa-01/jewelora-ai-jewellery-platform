from httpx import AsyncClient


async def test_health_ok(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}
    assert response.headers["x-request-id"]
    assert response.headers["x-content-type-options"] == "nosniff"


async def test_unknown_route_returns_safe_json(client: AsyncClient) -> None:
    response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_csrf_header_required_for_cookie_sessions(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/health", cookies={"access_token": "x"}, headers={"X-Requested-With": ""}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_rejected"
