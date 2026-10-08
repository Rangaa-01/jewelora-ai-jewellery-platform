"""Photo try-on API. Engine runs for real (MediaPipe) when models are present."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest
from httpx import AsyncClient
from jewelora_ai.models import models_available
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogue import ProductTryOnAsset
from app.services.tryon_service import EngineRuntime
from app.storage import get_storage
from app.storage.base import product_tryon_asset_key
from tests.factories import make_category, make_product, png_bytes
from tests.helpers import register_customer

FIXTURES = Path(__file__).resolve().parents[2] / "ai" / "tests" / "fixtures"
requires_models = pytest.mark.skipif(
    not models_available(), reason="MediaPipe models not downloaded"
)


async def _necklace_with_asset(db: AsyncSession):  # type: ignore[no-untyped-def]
    from datetime import UTC, datetime

    category = await make_category(db, "Necklaces", "necklace")
    product = await make_product(
        db, category, name="Test Necklace", tryon_enabled=True, with_variant=True
    )
    key = product_tryon_asset_key(str(product.id), "png")
    await get_storage().put(key, png_bytes((400, 200), alpha=True), "image/png")
    db.add(
        ProductTryOnAsset(
            product_id=product.id,
            storage_key=key,
            view="front",
            width=400,
            height=200,
            anchors={"left_end": [0.1, 0.1], "right_end": [0.9, 0.1], "bottom": [0.5, 0.9]},
            real_width_mm=Decimal("150"),
            real_height_mm=Decimal("75"),
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()
    await db.refresh(product)
    return product


async def test_capabilities_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/v1/tryon/capabilities")
    assert response.status_code == 200
    body = response.json()
    assert "necklace" in body["supported_types"] and "ring" in body["supported_types"]
    assert body["max_upload_mb"] >= 1


async def test_rejects_invalid_items_and_files(client: AsyncClient, db: AsyncSession) -> None:
    product = await _necklace_with_asset(db)
    bad_items = await client.post(
        "/api/v1/tryon/photo",
        files={"photo": ("p.jpg", (FIXTURES / "portrait_front.jpg").read_bytes(), "image/jpeg")},
        data={"items": "not json"},
    )
    assert bad_items.status_code == 422
    assert bad_items.json()["error"]["code"] == "invalid_items"

    not_image = await client.post(
        "/api/v1/tryon/photo",
        files={"photo": ("p.jpg", b"GIF89a" + b"\x00" * 200, "image/jpeg")},
        data={"items": json.dumps([{"product_id": str(product.id)}])},
    )
    assert not_image.status_code == 400
    assert not_image.json()["error"]["code"] == "invalid_upload"


@requires_models
async def test_guest_photo_tryon_roundtrip(client: AsyncClient, db: AsyncSession) -> None:
    product = await _necklace_with_asset(db)
    EngineRuntime.reset()
    response = await client.post(
        "/api/v1/tryon/photo",
        files={"photo": ("p.jpg", (FIXTURES / "portrait_front.jpg").read_bytes(), "image/jpeg")},
        data={
            "items": json.dumps(
                [{"product_id": str(product.id), "variant_id": str(product.variants[0].id)}]
            ),
            "mode": "look",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "completed"
    assert body["result_url"].startswith("/api/v1/media/private/") and "sig=" in body["result_url"]
    assert body["placements"][0]["region"] == "neck"
    assert body["placements"][0]["product_id"] == str(product.id)
    assert body["detection"]["face"] is True
    assert "jw_session" in client.cookies, "guests receive an anonymous session cookie"

    # The signed private URL serves the composite; an unsigned one is refused.
    served = await client.get(body["result_url"])
    assert served.status_code == 200 and served.headers["content-type"] == "image/webp"
    unsigned = await client.get(body["result_url"].split("?")[0])
    assert unsigned.status_code == 403

    fetched = await client.get(f"/api/v1/tryon/results/{body['id']}")
    assert fetched.status_code == 200

    adjusted = await client.post(
        f"/api/v1/tryon/results/{body['id']}/adjust",
        json={str(product.id): {"offset_y": 25, "scale": 1.2}},
    )
    assert adjusted.status_code == 201, adjusted.text
    assert adjusted.json()["items"][0]["adjustments"]["scale"] == 1.2
    assert adjusted.json()["id"] != body["id"]

    photos = await client.get("/api/v1/tryon/photos")
    assert len(photos.json()) == 1
    deleted = await client.delete(f"/api/v1/tryon/photos/{body['photo_id']}")
    assert deleted.status_code == 200
    assert (await client.get("/api/v1/tryon/photos")).json() == []


@requires_models
async def test_results_are_private_to_their_owner(client: AsyncClient, db: AsyncSession) -> None:
    product = await _necklace_with_asset(db)
    EngineRuntime.reset()
    response = await client.post(
        "/api/v1/tryon/photo",
        files={"photo": ("p.jpg", (FIXTURES / "portrait_front.jpg").read_bytes(), "image/jpeg")},
        data={"items": json.dumps([{"product_id": str(product.id)}])},
    )
    assert response.status_code == 201, response.text
    result_id = response.json()["id"]
    client.cookies.clear()
    await register_customer(client, email="other@example.com")
    assert (await client.get(f"/api/v1/tryon/results/{result_id}")).status_code == 403


@requires_models
async def test_hand_photo_with_necklace_fails_with_friendly_message(
    client: AsyncClient, db: AsyncSession
) -> None:
    product = await _necklace_with_asset(db)
    EngineRuntime.reset()
    response = await client.post(
        "/api/v1/tryon/photo",
        files={"photo": ("h.jpg", (FIXTURES / "hand_single.jpg").read_bytes(), "image/jpeg")},
        data={"items": json.dumps([{"product_id": str(product.id)}])},
    )
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "no_face"
    assert "face" in body["message"] and "Traceback" not in body["message"]


@requires_models
async def test_quality_levels_premium_and_guarded_refinement(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    import numpy as np

    product = await _necklace_with_asset(db)
    EngineRuntime.reset()
    caps = (await client.get("/api/v1/tryon/capabilities")).json()
    assert caps["refinement"] is False and caps["quality_levels"] == ["fast", "standard", "premium"]
    fast = await client.post(
        "/api/v1/tryon/photo",
        files={"photo": ("p.jpg", (FIXTURES / "portrait_front.jpg").read_bytes(), "image/jpeg")},
        data={"items": json.dumps([{"product_id": str(product.id)}]), "quality": "fast"},
    )
    assert fast.status_code == 201, fast.text
    body = fast.json()
    assert body["quality"] == "fast" and body["refined"] is False
    assert isinstance(body["photo_tips"], list)
    assert body["engine_version"].endswith("2.0")

    # Premium without a provider: full-quality deterministic render, honestly not "refined".
    premium = await client.post(f"/api/v1/tryon/results/{body['id']}/premium")
    assert premium.status_code == 201, premium.text
    assert premium.json()["quality"] == "premium" and premium.json()["refined"] is False

    # With a provider configured, its output only lands in the edge band around the piece.
    calls: list[tuple[int, ...]] = []

    class FakeProvider:
        name = "fake"
        available = True

        def refine(self, original, draft, coverage):  # type: ignore[no-untyped-def]
            calls.append(draft.shape)
            return np.zeros_like(draft)

    runtime = EngineRuntime.get(client._transport.app.state.settings)  # type: ignore[attr-defined]
    monkeypatch.setattr(runtime, "_refinement", FakeProvider())
    refined = await client.post(f"/api/v1/tryon/results/{body['id']}/premium")
    assert refined.status_code == 201 and refined.json()["refined"] is True and calls
    assert (await client.get(refined.json()["result_url"])).status_code == 200


@requires_models
async def test_failed_tryon_explains_with_photo_tips(client: AsyncClient, db: AsyncSession) -> None:
    product = await _necklace_with_asset(db)
    EngineRuntime.reset()
    response = await client.post(
        "/api/v1/tryon/photo",
        files={"photo": ("h.jpg", (FIXTURES / "hand_single.jpg").read_bytes(), "image/jpeg")},
        data={"items": json.dumps([{"product_id": str(product.id)}])},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "no_face" and "photo_tips" in error["details"]
