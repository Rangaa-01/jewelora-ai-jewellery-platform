"""Role-based access matrix for admin endpoints and upload abuse checks."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Role
from tests.factories import jpeg_bytes, make_category, make_product, make_staff, png_bytes
from tests.helpers import login, logout, register_customer


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        (None, 401),
        (Role.CUSTOMER, 403),
        (Role.SALES_STAFF, 403),
        (Role.MANAGER, 200),
        (Role.ADMIN, 200),
    ],
)
async def test_admin_product_list_access_matrix(
    client: AsyncClient, db: AsyncSession, role: Role | None, expected: int
) -> None:
    if role == Role.CUSTOMER:
        await register_customer(client)
    elif role is not None:
        email, password = await make_staff(db, role)
        await login(client, email, password)
    response = await client.get("/api/v1/admin/products")
    assert response.status_code == expected


async def test_only_admin_can_hard_delete(client: AsyncClient, db: AsyncSession) -> None:
    product = await make_product(db)
    email, password = await make_staff(db, Role.MANAGER)
    await login(client, email, password)
    assert (await client.delete(f"/api/v1/admin/products/{product.id}")).status_code == 403
    logout(client)
    email, password = await make_staff(db, Role.ADMIN)
    await login(client, email, password)
    assert (await client.delete(f"/api/v1/admin/products/{product.id}")).status_code == 200
    assert (await client.get(f"/api/v1/products/{product.slug}")).status_code == 404


async def test_manager_can_create_and_update_product(client: AsyncClient, db: AsyncSession) -> None:
    category = await make_category(db)
    email, password = await make_staff(db, Role.MANAGER)
    await login(client, email, password)
    payload = {
        "sku": "NK-1001",
        "name": "Antique Lakshmi Haram",
        "category_id": str(category.id),
        "jewellery_type": "haram",
        "metal_type": "gold",
        "purity": "22K",
        "base_price": "245000",
        "stock_quantity": 1,
        "occasions": ["Wedding", "wedding", "Festive"],
        "variants": [
            {"sku_suffix": "YG", "metal_type": "gold", "purity": "22K", "is_default": True},
            {
                "sku_suffix": "RG",
                "metal_type": "rose_gold",
                "purity": "18K",
                "price_delta": "-12000",
            },
        ],
        "sizes": [{"label": '24"', "measurement_mm": 610, "is_default": True}],
    }
    created = await client.post("/api/v1/admin/products", json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["slug"] == "antique-lakshmi-haram"
    assert body["occasions"] == ["wedding", "festive"]
    assert len(body["variants"]) == 2 and body["variants"][1]["price"] == "233000.00"

    duplicate = await client.post("/api/v1/admin/products", json=payload)
    assert duplicate.status_code == 409

    updated = await client.patch(
        f"/api/v1/admin/products/{body['id']}",
        json={
            "discount_percent": "5",
            "variants": [{"id": body["variants"][0]["id"], **payload["variants"][0]}],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["price"] == "232750.00"
    assert len(updated.json()["variants"]) == 1

    invalid = await client.post(
        "/api/v1/admin/products", json={**payload, "sku": "x", "base_price": "-1"}
    )
    assert invalid.status_code == 422
    fields = {d["field"] for d in invalid.json()["error"]["details"]}
    assert {"sku", "base_price"} <= fields


async def test_upload_validation_rejects_bad_files(client: AsyncClient, db: AsyncSession) -> None:
    product = await make_product(db)
    email, password = await make_staff(db, Role.MANAGER)
    await login(client, email, password)
    url = f"/api/v1/admin/products/{product.id}/images"

    not_image = await client.post(
        url, files={"file": ("evil.jpg", b"<?php echo 1; ?>" * 10, "image/jpeg")}
    )
    assert not_image.status_code == 400
    assert not_image.json()["error"]["code"] == "invalid_upload"

    svg = await client.post(
        url, files={"file": ("x.svg", b"<svg onload=alert(1)></svg>" * 4, "image/svg+xml")}
    )
    assert svg.status_code == 400

    ok = await client.post(
        url,
        files={"file": ("photo.jpg", jpeg_bytes(), "image/jpeg")},
        data={"meta": '{"alt_text": "Front"}'},
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["url"].endswith(".webp")

    opaque_tryon = await client.post(
        f"/api/v1/admin/products/{product.id}/tryon-assets",
        files={"file": ("a.png", png_bytes(), "image/png")},
    )
    assert opaque_tryon.status_code == 422
    assert opaque_tryon.json()["error"]["code"] == "asset_not_transparent"

    transparent = await client.post(
        f"/api/v1/admin/products/{product.id}/tryon-assets",
        files={"file": ("a.png", png_bytes(alpha=True), "image/png")},
        data={
            "meta": (
                '{"anchors": {"left_end": [0.1, 0.1], "right_end": [0.9, 0.1]},'
                ' "real_width_mm": 160}'
            )
        },
    )
    assert transparent.status_code == 201, transparent.text
    assert transparent.json()["anchors"]["left_end"] == [0.1, 0.1]

    bad_anchor = await client.post(
        f"/api/v1/admin/products/{product.id}/tryon-assets",
        files={"file": ("a.png", png_bytes(alpha=True), "image/png")},
        data={"meta": '{"anchors": {"left_end": [2, 0.1]}}'},
    )
    assert bad_anchor.status_code == 422

    bad_glb = await client.post(
        f"/api/v1/admin/products/{product.id}/models",
        files={"file": ("m.glb", b"not glb", "model/gltf-binary")},
    )
    assert bad_glb.status_code == 400


async def test_media_route_blocks_traversal_and_unsigned_private(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/media/public/../../etc/passwd")).status_code in (404, 403)
    assert (await client.get("/api/v1/media/private/customers/x/photos/a.webp")).status_code == 403
    assert (await client.get("/api/v1/media/etc/passwd")).status_code == 404


async def test_auto_cutout_turns_a_photo_into_a_try_on_asset(
    client: AsyncClient, db: AsyncSession
) -> None:
    from pathlib import Path

    from jewelora_ai.models import models_dir

    if not (models_dir() / "u2net.onnx").is_file():
        pytest.skip("u2net.onnx not downloaded")
    product = await make_product(db, jewellery_type="ring")
    email, password = await make_staff(db, Role.MANAGER)
    await login(client, email, password)
    photos = Path(__file__).resolve().parents[3] / "database" / "seeds" / "photos"  # noqa: ASYNC240
    response = await client.post(
        f"/api/v1/admin/products/{product.id}/tryon-assets",
        files={
            "file": ("ring.jpg", (photos / "ruby-flower-cluster-ring.jpg").read_bytes(), "image/jpeg")
        },
        data={"auto_cutout": "true"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert {"band_left", "band_right", "center", "top"} <= set(body["anchors"])
    assert body["real_width_mm"] is not None and body["url"].endswith(".webp")
