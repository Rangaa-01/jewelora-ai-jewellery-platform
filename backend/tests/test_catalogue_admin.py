"""Admin asset quality score."""

from __future__ import annotations

import io
from datetime import UTC, datetime
from decimal import Decimal

import numpy as np
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogue import ProductImage, ProductTryOnAsset
from app.models.enums import Role
from app.storage import get_storage
from app.storage.base import product_image_key, product_tryon_asset_key
from tests.factories import make_category, make_product, make_staff
from tests.helpers import login


def _photo(size: int, sharp: bool) -> bytes:
    rng = np.random.default_rng(3)
    img = np.full((size, size, 3), 235, dtype=np.uint8)
    yy, xx = np.mgrid[0:size, 0:size]
    ring = (np.hypot(xx - size / 2, yy - size / 2) < size * 0.3) & (
        np.hypot(xx - size / 2, yy - size / 2) > size * 0.22
    )
    img[ring] = (212, 175, 55)
    if sharp:
        texture = rng.integers(0, 60, size=(size, size), dtype=np.int16)
        img[ring] = np.clip(img[ring].astype(np.int16) - texture[ring][:, None], 0, 255).astype(
            np.uint8
        )
    pil = Image.fromarray(img)
    if not sharp:
        from PIL import ImageFilter

        pil = pil.filter(ImageFilter.GaussianBlur(6))
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


async def test_quality_score_rewards_good_assets_and_names_fixes(
    client: AsyncClient, db: AsyncSession
) -> None:
    category = await make_category(db, "Rings", "ring")
    product = await make_product(db, category, name="Score Ring", tryon_enabled=True)
    product_id = product.id
    storage = get_storage()
    email, password = await make_staff(db, Role.MANAGER)
    await login(client, email, password)

    bare = (await client.get(f"/api/v1/admin/products/{product.id}/quality")).json()
    keys = {c["key"]: c for c in bare["checks"]}
    assert keys["photo"]["status"] == "fail" and keys["tryon"]["status"] == "fail"
    assert bare["tryon_ready"] is False and bare["score"] < 40

    key = product_image_key(str(product.id), "jpg")
    await storage.put(key, _photo(1400, sharp=True), "image/jpeg")
    db.add(
        ProductImage(
            product_id=product.id,
            storage_key=key,
            width=1400,
            height=1400,
            is_primary=True,
            alt_text="ring",
            created_at=datetime.now(UTC),
        )
    )
    cut = np.zeros((700, 700, 4), dtype=np.uint8)
    cut[200:500, 200:500] = (212, 175, 55, 255)
    buf = io.BytesIO()
    Image.fromarray(cut).save(buf, format="PNG")
    tkey = product_tryon_asset_key(str(product.id), "png")
    await storage.put(tkey, buf.getvalue(), "image/png")
    db.add(
        ProductTryOnAsset(
            product_id=product.id,
            storage_key=tkey,
            view="front",
            width=700,
            height=700,
            anchors={"band_left": [0.3, 0.5], "band_right": [0.7, 0.5]},
            real_width_mm=Decimal("20"),
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()
    db.expire_all()  # a real request uses a fresh session; the test shares one
    good = (await client.get(f"/api/v1/admin/products/{product_id}/quality")).json()
    status = {c["key"]: c["status"] for c in good["checks"]}
    assert good["tryon_ready"] is True and good["score"] >= 80, good
    assert status["resolution"] == "pass" and status["transparency"] == "pass"
    assert status["anchors"] == "pass" and status["model3d"] == "warn"


async def test_quality_flags_backdrop_showing_through_a_cutout(
    client: AsyncClient, db: AsyncSession
) -> None:
    category = await make_category(db, "Necklaces", "necklace")
    product = await make_product(db, category, name="Velvet Necklace", tryon_enabled=True)
    product_id = product.id
    cut = np.zeros((600, 600, 4), dtype=np.uint8)
    cut[100:500, 100:500] = (10, 10, 12, 255)  # opaque velvet left inside the loop
    cut[100:140, 100:500] = (212, 175, 55, 255)
    buf = io.BytesIO()
    Image.fromarray(cut).save(buf, format="PNG")
    key = product_tryon_asset_key(str(product_id), "png")
    await get_storage().put(key, buf.getvalue(), "image/png")
    db.add(
        ProductTryOnAsset(
            product_id=product_id,
            storage_key=key,
            view="front",
            width=600,
            height=600,
            anchors={"left_end": [0.1, 0.2], "right_end": [0.9, 0.2]},
            real_width_mm=Decimal("150"),
            created_at=datetime.now(UTC),
        )
    )
    await db.flush()
    db.expire_all()
    email, password = await make_staff(db, Role.MANAGER)
    await login(client, email, password)
    report = (await client.get(f"/api/v1/admin/products/{product_id}/quality")).json()
    check = next(c for c in report["checks"] if c["key"] == "backdrop_inside")
    assert check["status"] == "fail" and "Reshoot" in check["detail"]
    assert report["tryon_ready"] is False
