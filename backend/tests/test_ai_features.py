from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest
from httpx import AsyncClient
from jewelora_ai.models import models_available
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.stylist_service import parse_constraints, rerank_with_anthropic, score_product
from app.services.visual_search_service import EmbedderRuntime, VisualSearchService
from app.storage import get_storage
from tests.factories import jpeg_bytes, make_category, make_product, png_bytes

FIXTURES = Path(__file__).resolve().parents[2] / "ai" / "tests" / "fixtures"
requires_models = pytest.mark.skipif(
    not models_available(), reason="MediaPipe models not downloaded"
)


def test_parse_constraints_understands_indian_jewellery_requests() -> None:
    c = parse_constraints(
        "I have a wedding next month. I want traditional gold jewellery under ₹2 lakh."
    )
    assert c.budget_max == Decimal("200000") and c.budget_min is None
    assert "wedding" in c.occasions and "gold" in c.metal_types and "traditional" in c.styles

    c = parse_constraints(
        "diamond solitaire ring in white gold between 50k and 1.5 lakh for our engagement"
    )
    assert c.budget_min == Decimal("50000") and c.budget_max == Decimal("150000")
    assert (
        c.jewellery_types == ["ring"]
        and c.stone_types == ["diamond"]
        and c.metal_types == ["white_gold"]
    )
    assert "engagement" in c.occasions

    c = parse_constraints("22k gold chain for my husband, light for daily wear")
    assert c.budget_max is None, "22k is a purity, not a budget"
    assert c.gender == "men" and "chain" in c.jewellery_types and "everyday" in c.occasions

    c = parse_constraints("jhumkas with pearls above 40000")
    assert (
        c.budget_min == Decimal("40000")
        and "earrings" in c.jewellery_types
        and "pearl" in c.stone_types
    )


async def test_scoring_respects_hard_constraints(db: AsyncSession) -> None:
    category = await make_category(db, "Rings", "ring")
    cheap = await make_product(
        db,
        category,
        name="Simple Band",
        price=Decimal("30000"),
        stone_type="none",
        occasions=["everyday"],
    )
    pricey = await make_product(
        db,
        category,
        name="Big Solitaire",
        price=Decimal("300000"),
        stone_type="diamond",
        occasions=["engagement"],
    )
    mens = await make_product(db, category, name="Signet", price=Decimal("50000"), gender="men")
    c = parse_constraints("diamond ring for her engagement under 1 lakh")
    assert score_product(pricey, c)[0] == 0, "over budget"
    assert score_product(mens, c)[0] == 0, "wrong gender"
    score, reasons = score_product(cheap, c)
    assert score > 0 and reasons


async def test_stylist_endpoint_only_returns_catalogue_products(
    client: AsyncClient, db: AsyncSession
) -> None:
    rings = await make_category(db, "Rings", "ring")
    necklaces = await make_category(db, "Necklaces", "necklace")
    solitaire = await make_product(
        db,
        rings,
        name="Aurora Solitaire",
        price=Decimal("90000"),
        stone_type="diamond",
        metal_type="white_gold",
        occasions=["engagement"],
        style="contemporary",
        with_image=True,
    )
    temple = await make_product(
        db,
        necklaces,
        name="Temple Necklace",
        price=Decimal("180000"),
        occasions=["wedding"],
        style="traditional",
        with_image=True,
    )
    await make_product(db, necklaces, name="Inactive", is_active=False)
    response = await client.post(
        "/api/v1/stylist/recommend",
        json={"query": "wedding next month, traditional gold under 2 lakh"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["llm_used"] is False and body["constraints"]["budget_max"] == "200000"
    names = [r["product"]["name"] for r in body["recommendations"]]
    assert names[0] == temple.name and "Inactive" not in names
    assert all(Decimal(r["product"]["price"]) <= 200000 for r in body["recommendations"])
    assert "Temple Necklace" in body["recommendations"][0]["reason"]

    strict = await client.post(
        "/api/v1/stylist/recommend", json={"query": "diamond ring under 1 lakh"}
    )
    assert strict.json()["recommendations"][0]["product"]["id"] == str(solitaire.id)

    impossible = await client.post(
        "/api/v1/stylist/recommend", json={"query": "platinum anklet under 500"}
    )
    assert impossible.status_code == 200 and impossible.json()["note"]

    short = await client.post("/api/v1/stylist/recommend", json={"query": "hi"})
    assert short.status_code == 422


async def test_llm_reranker_cannot_invent_products(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Anthropic call is mocked; ids outside the shortlist must be dropped."""
    import anthropic

    product = await make_product(db, name="Real Piece")
    shortlist = [(product, ["a match"], 5.0)]

    class FakeBlock:
        type = "text"
        text = json.dumps(
            {
                "picks": [
                    {"id": "00000000-0000-0000-0000-000000000000", "reason": "fake"},
                    {"id": str(product.id), "reason": "Lovely choice."},
                ]
            }
        )

    class FakeResponse:
        stop_reason = "end_turn"
        content = [FakeBlock()]

    captured: dict[str, object] = {}

    class FakeMessages:
        async def create(self, **kwargs: object) -> FakeResponse:
            captured.update(kwargs)
            return FakeResponse()

    class FakeClient:
        def __init__(self, **kwargs: object) -> None:
            self.messages = FakeMessages()

    monkeypatch.setattr(anthropic, "AsyncAnthropic", FakeClient)
    from app.core.settings import get_settings

    settings = get_settings().model_copy(
        update={"anthropic_api_key": "sk-test", "llm_provider": "anthropic"}
    )
    picks = await rerank_with_anthropic(
        settings, "something nice", parse_constraints("something nice"), shortlist, 5
    )
    assert picks is not None and [p.id for p, _, _ in picks] == [product.id]
    assert picks[0][1] == "Lovely choice."
    assert captured["model"] == "claude-opus-5-5"
    assert captured["output_config"]["format"]["type"] == "json_schema"  # type: ignore[index]


@requires_models
async def test_visual_search_finds_indexed_product(client: AsyncClient, db: AsyncSession) -> None:
    from datetime import UTC, datetime

    from app.models.catalogue import ProductImage
    from app.storage.base import product_image_key

    EmbedderRuntime.reset()
    product = await make_product(db, name="Photo Product")
    photo = (FIXTURES / "hand_single.jpg").read_bytes()
    key = product_image_key(str(product.id), "jpg")
    await get_storage().put(key, photo, "image/jpeg")
    db.add(
        ProductImage(
            product_id=product.id,
            storage_key=key,
            width=900,
            height=601,
            is_primary=True,
            alt_text="x",
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()
    await db.refresh(product)
    other = await make_product(db, name="Other", with_image=True)
    await get_storage().put(other.images[0].storage_key, png_bytes((64, 64)), "image/png")

    from app.core.settings import get_settings

    service = VisualSearchService(db, get_storage(), get_settings())
    assert await service.index_product(product) == 1
    assert await service.index_product(other) == 1

    response = await client.post(
        "/api/v1/visual-search", files={"image": ("q.jpg", photo, "image/jpeg")}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["indexed_products"] == 2
    assert body["exact"] is not None and body["exact"]["product"]["name"] == "Photo Product"

    unrelated = await client.post(
        "/api/v1/visual-search", files={"image": ("q.jpg", jpeg_bytes((128, 128)), "image/jpeg")}
    )
    assert unrelated.status_code == 200 and unrelated.json()["exact"] is None
