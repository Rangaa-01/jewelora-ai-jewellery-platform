from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from pydantic import Field, field_validator

from app.models.enums import AssetView, Gender, JewelleryType, MetalType, StoneType
from app.schemas.common import APIModel


class CategoryOut(APIModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    parent_id: uuid.UUID | None
    jewellery_type: str | None
    image_url: str | None = None
    sort_order: int
    is_active: bool
    product_count: int = 0


class CollectionOut(APIModel):
    id: uuid.UUID
    name: str
    slug: str
    tagline: str | None
    description: str | None
    hero_image_url: str | None = None
    is_bridal: bool
    is_featured: bool
    sort_order: int
    is_active: bool
    product_count: int = 0


class ProductImageOut(APIModel):
    id: uuid.UUID
    url: str
    alt_text: str
    view: str
    width: int | None
    height: int | None
    is_primary: bool
    variant_id: uuid.UUID | None


class ProductVariantOut(APIModel):
    id: uuid.UUID
    sku_suffix: str
    metal_type: str
    stone_type: str
    purity: str | None
    price_delta: Decimal
    price: Decimal
    stock_quantity: int
    tint_hex: str | None
    is_default: bool
    is_active: bool


class ProductSizeOut(APIModel):
    id: uuid.UUID
    label: str
    measurement_mm: Decimal | None
    price_delta: Decimal
    stock_quantity: int
    is_default: bool


class TryOnAssetOut(APIModel):
    id: uuid.UUID
    url: str
    view: str
    width: int
    height: int
    anchors: dict[str, Any]
    real_width_mm: Decimal | None
    real_height_mm: Decimal | None
    variant_id: uuid.UUID | None


class Model3DAssetOut(APIModel):
    id: uuid.UUID
    url: str
    format: str
    file_size_bytes: int
    scale: float
    material_overrides: dict[str, Any] | None
    variant_id: uuid.UUID | None
    is_primary: bool


class ProductSummaryOut(APIModel):
    """Card-level product data for listings."""

    id: uuid.UUID
    sku: str
    slug: str
    name: str
    short_description: str | None
    category: CategoryOut
    jewellery_type: str
    metal_type: str
    purity: str | None
    stone_type: str
    base_price: Decimal
    discount_percent: Decimal
    price: Decimal
    currency: str
    in_stock: bool
    is_made_to_order: bool
    tryon_enabled: bool
    has_3d: bool
    is_featured: bool
    is_new: bool
    gender: str
    occasions: list[str]
    tags: list[str]
    style: str | None
    primary_image: ProductImageOut | None
    hover_image: ProductImageOut | None = None


class ProductSetItemOut(APIModel):
    product: ProductSummaryOut
    quantity: int


class ProductDetailOut(ProductSummaryOut):
    description: str | None
    gross_weight_g: Decimal | None
    net_weight_g: Decimal | None
    stone_weight_ct: Decimal | None
    diamond_details: dict[str, Any] | None
    making_charges: Decimal
    stock_quantity: int
    images: list[ProductImageOut]
    variants: list[ProductVariantOut]
    sizes: list[ProductSizeOut]
    tryon_assets: list[TryOnAssetOut]
    model_3d_assets: list[Model3DAssetOut]
    collections: list[CollectionOut]
    set_items: list[ProductSetItemOut]
    is_active: bool


class ProductFilters(APIModel):
    q: str | None = Field(default=None, max_length=120)
    category: str | None = None  # slug
    collection: str | None = None  # slug
    jewellery_type: list[JewelleryType] | None = None
    metal_type: list[MetalType] | None = None
    stone_type: list[StoneType] | None = None
    gender: Gender | None = None
    occasion: str | None = Field(default=None, max_length=40)
    style: str | None = Field(default=None, max_length=40)
    min_price: Decimal | None = Field(default=None, ge=0)
    max_price: Decimal | None = Field(default=None, ge=0)
    tryon_only: bool = False
    in_stock_only: bool = False
    featured: bool | None = None
    is_new: bool | None = None
    sort: str = Field(
        default="relevance", pattern=r"^(relevance|newest|price_asc|price_desc|popular)$"
    )
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=96)
    include_inactive: bool = False  # staff only; ignored for customers


# --- Admin write schemas ---------------------------------------------------------


class ProductVariantIn(APIModel):
    id: uuid.UUID | None = None
    sku_suffix: str = Field(min_length=1, max_length=32)
    metal_type: MetalType
    stone_type: StoneType = StoneType.NONE
    purity: str | None = Field(default=None, max_length=16)
    price_delta: Decimal = Decimal("0")
    stock_quantity: int = Field(default=0, ge=0)
    tint_hex: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    is_default: bool = False
    is_active: bool = True
    sort_order: int = 0


class ProductSizeIn(APIModel):
    id: uuid.UUID | None = None
    label: str = Field(min_length=1, max_length=32)
    measurement_mm: Decimal | None = Field(default=None, ge=0)
    price_delta: Decimal = Decimal("0")
    stock_quantity: int = Field(default=0, ge=0)
    is_default: bool = False
    sort_order: int = 0


class ProductIn(APIModel):
    sku: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9\-_.]+$")
    name: str = Field(min_length=2, max_length=180)
    slug: str | None = Field(default=None, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    short_description: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=10_000)
    category_id: uuid.UUID
    jewellery_type: JewelleryType
    metal_type: MetalType
    purity: str | None = Field(default=None, max_length=16)
    stone_type: StoneType = StoneType.NONE
    gross_weight_g: Decimal | None = Field(default=None, ge=0)
    net_weight_g: Decimal | None = Field(default=None, ge=0)
    stone_weight_ct: Decimal | None = Field(default=None, ge=0)
    diamond_details: dict[str, Any] | None = None
    making_charges: Decimal = Field(default=Decimal("0"), ge=0)
    base_price: Decimal = Field(ge=0)
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    stock_quantity: int = Field(default=0, ge=0)
    is_made_to_order: bool = False
    gender: Gender = Gender.WOMEN
    occasions: list[str] = Field(default_factory=list, max_length=20)
    tags: list[str] = Field(default_factory=list, max_length=30)
    style: str | None = Field(default=None, max_length=40)
    tryon_enabled: bool = False
    is_featured: bool = False
    is_new: bool = False
    is_active: bool = True
    collection_ids: list[uuid.UUID] = Field(default_factory=list)
    variants: list[ProductVariantIn] = Field(default_factory=list)
    sizes: list[ProductSizeIn] = Field(default_factory=list)
    set_item_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("occasions", "tags")
    @classmethod
    def _clean_list(cls, v: list[str]) -> list[str]:
        cleaned = []
        for item in v:
            item = item.strip().lower()[:40]
            if item and item not in cleaned:
                cleaned.append(item)
        return cleaned


class ProductUpdate(ProductIn):
    sku: str | None = Field(
        default=None, min_length=2, max_length=64, pattern=r"^[A-Za-z0-9\-_.]+$"
    )  # type: ignore[assignment]
    name: str | None = Field(default=None, min_length=2, max_length=180)  # type: ignore[assignment]
    category_id: uuid.UUID | None = None  # type: ignore[assignment]
    jewellery_type: JewelleryType | None = None  # type: ignore[assignment]
    metal_type: MetalType | None = None  # type: ignore[assignment]
    base_price: Decimal | None = Field(default=None, ge=0)  # type: ignore[assignment]
    stone_type: StoneType | None = None  # type: ignore[assignment]
    making_charges: Decimal | None = Field(default=None, ge=0)  # type: ignore[assignment]
    discount_percent: Decimal | None = Field(default=None, ge=0, le=100)  # type: ignore[assignment]
    stock_quantity: int | None = Field(default=None, ge=0)  # type: ignore[assignment]
    is_made_to_order: bool | None = None  # type: ignore[assignment]
    gender: Gender | None = None  # type: ignore[assignment]
    occasions: list[str] | None = None  # type: ignore[assignment]
    tags: list[str] | None = None  # type: ignore[assignment]
    tryon_enabled: bool | None = None  # type: ignore[assignment]
    is_featured: bool | None = None  # type: ignore[assignment]
    is_new: bool | None = None  # type: ignore[assignment]
    is_active: bool | None = None  # type: ignore[assignment]
    collection_ids: list[uuid.UUID] | None = None  # type: ignore[assignment]
    variants: list[ProductVariantIn] | None = None  # type: ignore[assignment]
    sizes: list[ProductSizeIn] | None = None  # type: ignore[assignment]
    set_item_ids: list[uuid.UUID] | None = None  # type: ignore[assignment]

    @field_validator("occasions", "tags")
    @classmethod
    def _clean_list_optional(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else ProductIn._clean_list(v)


class CategoryIn(APIModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str | None = Field(default=None, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = Field(default=None, max_length=2000)
    parent_id: uuid.UUID | None = None
    jewellery_type: JewelleryType | None = None
    sort_order: int = 0
    is_active: bool = True


class CollectionIn(APIModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=140, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    tagline: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_bridal: bool = False
    is_featured: bool = False
    sort_order: int = 0
    is_active: bool = True
    product_ids: list[uuid.UUID] | None = None


class TryOnAssetMetaIn(APIModel):
    view: AssetView = AssetView.FRONT
    variant_id: uuid.UUID | None = None
    anchors: dict[str, list[float]] = Field(default_factory=dict)
    real_width_mm: Decimal | None = Field(default=None, gt=0)
    real_height_mm: Decimal | None = Field(default=None, gt=0)

    @field_validator("anchors")
    @classmethod
    def _anchors(cls, v: dict[str, list[float]]) -> dict[str, list[float]]:
        for name, point in v.items():
            if len(point) != 2 or not all(0 <= c <= 1 for c in point):
                raise ValueError(f"Anchor '{name}' must be [x, y] with values between 0 and 1")
        return v


class Model3DAssetMetaIn(APIModel):
    variant_id: uuid.UUID | None = None
    scale: float = Field(default=1.0, gt=0, le=1000)
    material_overrides: dict[str, Any] | None = None
    is_primary: bool = True


class ProductImageMetaIn(APIModel):
    alt_text: str = Field(default="", max_length=255)
    view: AssetView = AssetView.FRONT
    variant_id: uuid.UUID | None = None
    is_primary: bool = False
    sort_order: int = 0
