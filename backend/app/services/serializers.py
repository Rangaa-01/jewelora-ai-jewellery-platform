"""ORM → API schema conversion with storage URL resolution."""

from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal

from app.models.catalogue import (
    Collection,
    Product,
    Product3DAsset,
    ProductCategory,
    ProductImage,
    ProductSize,
    ProductTryOnAsset,
    ProductVariant,
)
from app.models.user import Store
from app.schemas.catalogue import (
    CategoryOut,
    CollectionOut,
    Model3DAssetOut,
    ProductDetailOut,
    ProductImageOut,
    ProductSetItemOut,
    ProductSizeOut,
    ProductSummaryOut,
    ProductVariantOut,
    TryOnAssetOut,
)
from app.schemas.store import StoreOut
from app.storage import ObjectStorage, url_for_key


def _url(key: str | None, storage: ObjectStorage) -> str | None:
    return url_for_key(key, storage)


def category_out(
    category: ProductCategory, storage: ObjectStorage, product_count: int = 0
) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        name=category.name,
        slug=category.slug,
        description=category.description,
        parent_id=category.parent_id,
        jewellery_type=category.jewellery_type,
        image_url=_url(category.image_key, storage),
        sort_order=category.sort_order,
        is_active=category.is_active,
        product_count=product_count,
    )


def collection_out(
    collection: Collection, storage: ObjectStorage, product_count: int = 0
) -> CollectionOut:
    return CollectionOut(
        id=collection.id,
        name=collection.name,
        slug=collection.slug,
        tagline=collection.tagline,
        description=collection.description,
        hero_image_url=_url(collection.hero_image_key, storage),
        is_bridal=collection.is_bridal,
        is_featured=collection.is_featured,
        sort_order=collection.sort_order,
        is_active=collection.is_active,
        product_count=product_count,
    )


def image_out(image: ProductImage, storage: ObjectStorage) -> ProductImageOut:
    return ProductImageOut(
        id=image.id,
        url=storage.public_url(image.storage_key),
        alt_text=image.alt_text,
        view=image.view,
        width=image.width,
        height=image.height,
        is_primary=image.is_primary,
        variant_id=image.variant_id,
    )


def variant_out(variant: ProductVariant, base_price: Decimal) -> ProductVariantOut:
    return ProductVariantOut(
        id=variant.id,
        sku_suffix=variant.sku_suffix,
        metal_type=variant.metal_type,
        stone_type=variant.stone_type,
        purity=variant.purity,
        price_delta=variant.price_delta,
        price=base_price + variant.price_delta,
        stock_quantity=variant.stock_quantity,
        tint_hex=variant.tint_hex,
        is_default=variant.is_default,
        is_active=variant.is_active,
    )


def size_out(size: ProductSize) -> ProductSizeOut:
    return ProductSizeOut.model_validate(size)


def tryon_asset_out(asset: ProductTryOnAsset, storage: ObjectStorage) -> TryOnAssetOut:
    return TryOnAssetOut(
        id=asset.id,
        url=storage.public_url(asset.storage_key),
        view=asset.view,
        width=asset.width,
        height=asset.height,
        anchors=asset.anchors,
        real_width_mm=asset.real_width_mm,
        real_height_mm=asset.real_height_mm,
        variant_id=asset.variant_id,
    )


def model_3d_out(asset: Product3DAsset, storage: ObjectStorage) -> Model3DAssetOut:
    return Model3DAssetOut(
        id=asset.id,
        url=storage.public_url(asset.storage_key),
        format=asset.format,
        file_size_bytes=asset.file_size_bytes,
        scale=asset.scale,
        material_overrides=asset.material_overrides,
        variant_id=asset.variant_id,
        is_primary=asset.is_primary,
    )


def _primary_and_hover(
    images: Iterable[ProductImage], storage: ObjectStorage
) -> tuple[ProductImageOut | None, ProductImageOut | None]:
    ordered = sorted(images, key=lambda i: (not i.is_primary, i.sort_order))
    primary = image_out(ordered[0], storage) if ordered else None
    hover = image_out(ordered[1], storage) if len(ordered) > 1 else None
    return primary, hover


def _summary_fields(product: Product, storage: ObjectStorage) -> dict[str, object]:
    primary, hover = _primary_and_hover(product.images, storage)
    in_stock = (
        product.is_made_to_order
        or product.stock_quantity > 0
        or any(v.stock_quantity > 0 for v in product.variants)
    )
    return {
        "id": product.id,
        "sku": product.sku,
        "slug": product.slug,
        "name": product.name,
        "short_description": product.short_description,
        "category": category_out(product.category, storage),
        "jewellery_type": product.jewellery_type,
        "metal_type": product.metal_type,
        "purity": product.purity,
        "stone_type": product.stone_type,
        "base_price": product.base_price,
        "discount_percent": product.discount_percent,
        "price": product.price,
        "currency": product.currency,
        "in_stock": in_stock,
        "is_made_to_order": product.is_made_to_order,
        "tryon_enabled": product.tryon_enabled and bool(product.tryon_assets),
        "has_3d": bool(product.model_3d_assets),
        "is_featured": product.is_featured,
        "is_new": product.is_new,
        "gender": product.gender,
        "occasions": product.occasions,
        "tags": product.tags,
        "style": product.style,
        "primary_image": primary,
        "hover_image": hover,
    }


def product_summary_out(product: Product, storage: ObjectStorage) -> ProductSummaryOut:
    return ProductSummaryOut(**_summary_fields(product, storage))


def product_detail_out(product: Product, storage: ObjectStorage) -> ProductDetailOut:
    fields = _summary_fields(product, storage)
    fields.update(
        {
            "description": product.description,
            "gross_weight_g": product.gross_weight_g,
            "net_weight_g": product.net_weight_g,
            "stone_weight_ct": product.stone_weight_ct,
            "diamond_details": product.diamond_details,
            "making_charges": product.making_charges,
            "stock_quantity": product.stock_quantity,
            "images": [image_out(i, storage) for i in product.images],
            "variants": [variant_out(v, product.price) for v in product.variants if v.is_active],
            "sizes": [size_out(s) for s in product.sizes],
            "tryon_assets": [tryon_asset_out(a, storage) for a in product.tryon_assets],
            "model_3d_assets": [model_3d_out(m, storage) for m in product.model_3d_assets],
            "collections": [collection_out(c, storage) for c in product.collections if c.is_active],
            "set_items": [
                ProductSetItemOut(
                    product=product_summary_out(item.component, storage), quantity=item.quantity
                )
                for item in product.set_items
                if item.component.is_active
            ],
            "is_active": product.is_active,
        }
    )
    return ProductDetailOut(**fields)


def store_out(store: Store) -> StoreOut:
    return StoreOut.model_validate(store)
