"""Lightweight test data builders (no Faker randomness so tests stay deterministic)."""

from __future__ import annotations

import io
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.models.catalogue import (
    Collection,
    Product,
    ProductCategory,
    ProductImage,
    ProductSize,
    ProductVariant,
)
from app.models.enums import Role
from app.models.user import Store
from app.services.auth_service import AuthService
from app.services.slug import slugify


async def make_category(
    db: AsyncSession, name: str = "Necklaces", jewellery_type: str = "necklace"
) -> ProductCategory:
    category = ProductCategory(
        name=name, slug=slugify(name) + "-" + uuid.uuid4().hex[:6], jewellery_type=jewellery_type
    )
    db.add(category)
    await db.flush()
    return category


async def make_collection(db: AsyncSession, name: str = "Heritage", **kwargs: object) -> Collection:
    collection = Collection(name=name, slug=slugify(name) + "-" + uuid.uuid4().hex[:6], **kwargs)  # type: ignore[arg-type]
    db.add(collection)
    await db.flush()
    return collection


async def make_product(
    db: AsyncSession,
    category: ProductCategory | None = None,
    name: str = "Temple Gold Necklace",
    price: Decimal = Decimal("185000.00"),
    *,
    with_image: bool = False,
    with_variant: bool = False,
    with_size: bool = False,
    **kwargs: object,
) -> Product:
    category = category or await make_category(db)
    suffix = uuid.uuid4().hex[:8]
    product = Product(
        sku=f"SKU-{suffix}",
        slug=f"{slugify(name)}-{suffix}",
        name=name,
        category_id=category.id,
        jewellery_type=kwargs.pop("jewellery_type", category.jewellery_type or "necklace"),
        metal_type=kwargs.pop("metal_type", "gold"),
        purity=kwargs.pop("purity", "22K"),
        base_price=price,
        stock_quantity=kwargs.pop("stock_quantity", 3),
        **kwargs,  # type: ignore[arg-type]
    )
    db.add(product)
    await db.flush()
    if with_image:
        db.add(
            ProductImage(
                product_id=product.id,
                storage_key=f"public/products/{product.id}/images/test.webp",
                width=1200,
                height=1200,
                is_primary=True,
                alt_text=name,
                created_at=datetime.now(UTC),
            )
        )
    if with_variant:
        db.add(
            ProductVariant(
                product_id=product.id, sku_suffix="RG", metal_type="rose_gold", is_default=True
            )
        )
    if with_size:
        db.add(
            ProductSize(
                product_id=product.id, label='18"', measurement_mm=Decimal("457"), is_default=True
            )
        )
    await db.flush()
    await db.refresh(product)
    return product


async def make_store(db: AsyncSession, name: str = "Jewelora Flagship") -> Store:
    store = Store(
        name=name,
        slug=slugify(name) + "-" + uuid.uuid4().hex[:6],
        address_line1="12 MG Road",
        city="Chennai",
        state="Tamil Nadu",
        postal_code="600001",
    )
    db.add(store)
    await db.flush()
    return store


async def make_staff(
    db: AsyncSession, role: Role, email: str | None = None, password: str = "Staff#12345"
) -> tuple[str, str]:
    email = email or f"{role.value}-{uuid.uuid4().hex[:6]}@jewelora.test"
    await AuthService(db, get_settings()).create_staff_user(
        full_name=f"{role.value} user", email=email, password=password, roles=[role]
    )
    return email, password


def png_bytes(size: tuple[int, int] = (64, 64), alpha: bool = False) -> bytes:
    img = Image.new(
        "RGBA" if alpha else "RGB", size, (200, 160, 60, 255) if alpha else (200, 160, 60)
    )
    if alpha:
        for x in range(size[0] // 2):
            for y in range(size[1]):
                img.putpixel((x, y), (0, 0, 0, 0))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def jpeg_bytes(size: tuple[int, int] = (64, 64)) -> bytes:
    img = Image.new("RGB", size, (120, 90, 30))
    out = io.BytesIO()
    img.save(out, format="JPEG")
    return out.getvalue()
