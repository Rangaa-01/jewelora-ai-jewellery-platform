from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    pass


class ProductCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "product_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_categories.id", ondelete="SET NULL"), index=True
    )
    jewellery_type: Mapped[str | None] = mapped_column(
        String(32)
    )  # default try-on type for products
    image_key: Mapped[str | None] = mapped_column(String(512))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    parent: Mapped[ProductCategory | None] = relationship(
        remote_side="ProductCategory.id", lazy="joined", join_depth=1
    )
    products: Mapped[list[Product]] = relationship(back_populates="category")


class Collection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "collections"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    hero_image_key: Mapped[str | None] = mapped_column(String(512))
    is_bridal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    products: Mapped[list[Product]] = relationship(
        secondary="product_collections", back_populates="collections"
    )


class ProductCollection(Base):
    __tablename__ = "product_collections"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class MetalRate(UUIDPrimaryKeyMixin, Base):
    """Daily metal rate per gram, used to recompute weight-based prices."""

    __tablename__ = "metal_rates"
    __table_args__ = (UniqueConstraint("metal_type", "purity", "effective_date"),)

    metal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    purity: Mapped[str] = mapped_column(String(16), nullable=False)  # e.g. 22K, 18K, 950
    rate_per_gram: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    effective_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Product(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("base_price >= 0", name="base_price_non_negative"),
        CheckConstraint("discount_percent >= 0 AND discount_percent <= 100", name="discount_range"),
        CheckConstraint("stock_quantity >= 0", name="stock_non_negative"),
        Index("ix_products_active_category", "is_active", "category_id"),
        Index("ix_products_jewellery_type", "jewellery_type"),
        Index(
            "ix_products_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
        Index("ix_products_tags", "tags", postgresql_using="gin"),
    )

    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    short_description: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_categories.id", ondelete="RESTRICT"), nullable=False
    )
    jewellery_type: Mapped[str] = mapped_column(String(32), nullable=False)
    metal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    purity: Mapped[str | None] = mapped_column(String(16))  # 22K / 18K / 14K / 950
    stone_type: Mapped[str] = mapped_column(String(32), default="none", nullable=False)
    gross_weight_g: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    net_weight_g: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    stone_weight_ct: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    diamond_details: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB
    )  # clarity, colour, cut, count
    making_charges: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_made_to_order: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    gender: Mapped[str] = mapped_column(String(16), default="women", nullable=False)
    occasions: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list, nullable=False)
    style: Mapped[str | None] = mapped_column(
        String(40)
    )  # traditional, contemporary, minimal, bridal...
    tryon_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tryon_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wishlist_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    category: Mapped[ProductCategory] = relationship(back_populates="products", lazy="joined")
    collections: Mapped[list[Collection]] = relationship(
        secondary="product_collections", back_populates="products", lazy="selectin"
    )
    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProductVariant.sort_order",
    )
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProductImage.sort_order",
    )
    tryon_assets: Mapped[list[ProductTryOnAsset]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )
    model_3d_assets: Mapped[list[Product3DAsset]] = relationship(
        back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )
    sizes: Mapped[list[ProductSize]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProductSize.sort_order",
    )
    set_items: Mapped[list[ProductSetItem]] = relationship(
        foreign_keys="ProductSetItem.set_product_id", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def price(self) -> Decimal:
        discount = (self.base_price * self.discount_percent / Decimal(100)).quantize(
            Decimal("0.01")
        )
        return self.base_price - discount


class ProductVariant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A configured metal/stone variation of a product. Only configured variants are offered."""

    __tablename__ = "product_variants"
    __table_args__ = (UniqueConstraint("product_id", "metal_type", "stone_type", "purity"),)

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    sku_suffix: Mapped[str] = mapped_column(String(32), nullable=False)
    metal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    stone_type: Mapped[str] = mapped_column(String(32), default="none", nullable=False)
    purity: Mapped[str | None] = mapped_column(String(16))
    price_delta: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tint_hex: Mapped[str | None] = mapped_column(String(7))  # colour used to recolour try-on assets
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped[Product] = relationship(back_populates="variants")


class ProductImage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "product_images"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    alt_text: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    view: Mapped[str] = mapped_column(String(16), default="front", nullable=False)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    product: Mapped[Product] = relationship(back_populates="images")


class ProductTryOnAsset(UUIDPrimaryKeyMixin, Base):
    """Transparent PNG/WebP used by the try-on engine, with anchor metadata.

    ``anchors`` maps semantic anchor names to normalised (0-1) coordinates inside the asset,
    e.g. for a necklace ``{"left_end": [0.05, 0.1], "right_end": [0.95, 0.1]}``.
    ``real_width_mm`` lets the fitter scale the asset to the detected body dimension.
    """

    __tablename__ = "product_tryon_assets"
    __table_args__ = (UniqueConstraint("product_id", "variant_id", "view"),)

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE")
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    view: Mapped[str] = mapped_column(String(16), default="front", nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    anchors: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    real_width_mm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    real_height_mm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    product: Mapped[Product] = relationship(back_populates="tryon_assets")


class Product3DAsset(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "product_3d_assets"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE")
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    format: Mapped[str] = mapped_column(String(8), default="glb", nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    scale: Mapped[float] = mapped_column(default=1.0, nullable=False)
    material_overrides: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    product: Mapped[Product] = relationship(back_populates="model_3d_assets")


class ProductSize(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "product_sizes"
    __table_args__ = (UniqueConstraint("product_id", "label"),)

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(32), nullable=False)  # 16", 18", S, M, L, 12 (ring)
    measurement_mm: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2)
    )  # length / inner diameter / circumference
    price_delta: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped[Product] = relationship(back_populates="sizes")


class ProductSetItem(Base):
    """Components of a jewellery set product (e.g. bridal set = necklace + earrings + tikka)."""

    __tablename__ = "product_set_items"

    set_product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    component_product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    component: Mapped[Product] = relationship(foreign_keys=[component_product_id], lazy="joined")


class ProductEmbedding(Base):
    """Visual embedding of a product image, used by visual search and stylist similarity."""

    __tablename__ = "product_embeddings"

    product_image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_images.id", ondelete="CASCADE"), primary_key=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    model_name: Mapped[str] = mapped_column(String(64), nullable=False)
    dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    vector: Mapped[list[float]] = mapped_column(ARRAY(Numeric(8, 6)), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
