from __future__ import annotations

from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import make_category, make_collection, make_product


async def test_list_products_pagination_and_filters(client: AsyncClient, db: AsyncSession) -> None:
    necklaces = await make_category(db, "Necklaces", "necklace")
    rings = await make_category(db, "Rings", "ring")
    for i in range(3):
        await make_product(
            db, necklaces, name=f"Necklace {i}", price=Decimal(100000 + i * 1000), with_image=True
        )
    await make_product(
        db,
        rings,
        name="Solitaire Ring",
        price=Decimal("45000"),
        stone_type="diamond",
        is_featured=True,
    )
    await make_product(db, rings, name="Hidden Ring", is_active=False)

    all_products = await client.get("/api/v1/products", params={"page_size": 2})
    assert all_products.status_code == 200
    body = all_products.json()
    assert body["total"] == 4 and len(body["items"]) == 2 and body["pages"] == 2

    by_category = await client.get("/api/v1/products", params={"category": rings.slug})
    assert [p["name"] for p in by_category.json()["items"]] == ["Solitaire Ring"]

    by_type = await client.get(
        "/api/v1/products", params={"jewellery_type": ["necklace"], "sort": "price_asc"}
    )
    prices = [Decimal(p["price"]) for p in by_type.json()["items"]]
    assert prices == sorted(prices) and len(prices) == 3

    featured = await client.get("/api/v1/products", params={"featured": "true"})
    assert featured.json()["total"] == 1

    priced = await client.get("/api/v1/products", params={"max_price": 50000})
    assert priced.json()["total"] == 1

    searched = await client.get("/api/v1/products", params={"q": "solitaire"})
    assert searched.json()["total"] == 1

    inactive_requested = await client.get("/api/v1/products", params={"include_inactive": "true"})
    assert inactive_requested.json()["total"] == 4, "anonymous callers never see inactive products"


async def test_product_detail_and_404(client: AsyncClient, db: AsyncSession) -> None:
    product = await make_product(
        db, with_image=True, with_variant=True, with_size=True, discount_percent=Decimal("10")
    )
    response = await client.get(f"/api/v1/products/{product.slug}")
    assert response.status_code == 200
    body = response.json()
    assert body["price"] == "166500.00"
    assert body["primary_image"]["url"].startswith("/api/v1/media/public/products/")
    assert body["variants"][0]["metal_type"] == "rose_gold"
    assert body["sizes"][0]["label"] == '18"'
    assert body["in_stock"] is True
    assert body["tryon_enabled"] is False

    missing = await client.get("/api/v1/products/does-not-exist")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "product_not_found"


async def test_categories_and_collections_with_counts(
    client: AsyncClient, db: AsyncSession
) -> None:
    category = await make_category(db, "Earrings", "earrings")
    collection = await make_collection(db, "Bridal Edit", is_bridal=True, is_featured=True)
    product = await make_product(db, category, name="Jhumka")
    product.collections.append(collection)
    await db.flush()

    categories = await client.get("/api/v1/categories")
    assert categories.status_code == 200
    earrings = next(c for c in categories.json() if c["slug"] == category.slug)
    assert earrings["product_count"] == 1

    collections = await client.get("/api/v1/collections", params={"featured": "true"})
    assert collections.json()[0]["slug"] == collection.slug
    assert collections.json()[0]["product_count"] == 1

    in_collection = await client.get(f"/api/v1/collections/{collection.slug}/products")
    assert in_collection.json()["total"] == 1
    assert in_collection.json()["items"][0]["name"] == "Jhumka"


async def test_related_products_excludes_self(client: AsyncClient, db: AsyncSession) -> None:
    category = await make_category(db, "Bangles", "bangle")
    first = await make_product(db, category, name="Bangle A")
    await make_product(db, category, name="Bangle B")
    response = await client.get(f"/api/v1/products/{first.slug}/related")
    assert [p["name"] for p in response.json()] == ["Bangle B"]
