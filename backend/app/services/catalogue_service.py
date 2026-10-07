"""Catalogue queries and admin mutations for products, categories and collections."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import ColumnElement, Numeric, Select, cast, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.models.catalogue import (
    Collection,
    Product,
    Product3DAsset,
    ProductCategory,
    ProductCollection,
    ProductImage,
    ProductSetItem,
    ProductSize,
    ProductTryOnAsset,
    ProductVariant,
)
from app.schemas.catalogue import (
    CategoryIn,
    CollectionIn,
    ProductFilters,
    ProductIn,
    ProductSizeIn,
    ProductUpdate,
    ProductVariantIn,
)
from app.services.slug import slugify

PRODUCT_LOAD_OPTIONS = (
    selectinload(Product.images),
    selectinload(Product.variants),
    selectinload(Product.sizes),
    selectinload(Product.tryon_assets),
    selectinload(Product.model_3d_assets),
    selectinload(Product.collections),
    selectinload(Product.set_items)
    .selectinload(ProductSetItem.component)
    .selectinload(Product.images),
)


def _price_expr() -> ColumnElement[Decimal]:
    """Effective selling price as a SQL expression (base price less percentage discount)."""
    return cast(
        Product.base_price * (literal(1) - Product.discount_percent / literal(100)),
        Numeric(14, 2),
    )


class CatalogueService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # --- products: read -----------------------------------------------------------------

    def _base_query(self, include_inactive: bool) -> Select[Product]:
        stmt = select(Product).options(*PRODUCT_LOAD_OPTIONS)
        if not include_inactive:
            stmt = stmt.where(Product.is_active.is_(True))
        return stmt

    def _apply_filters(self, stmt: Select[Product], f: ProductFilters) -> Select[Product]:
        if f.q:
            term = f"%{f.q.strip()}%"
            stmt = stmt.where(
                or_(
                    Product.name.ilike(term),
                    Product.sku.ilike(term),
                    Product.short_description.ilike(term),
                    Product.tags.any(literal(f.q.strip().lower())),
                    func.similarity(Product.name, f.q.strip()) > 0.25,
                )
            )
        if f.category:
            cat_alias = select(ProductCategory.id).where(
                or_(
                    ProductCategory.slug == f.category,
                    ProductCategory.parent_id.in_(
                        select(ProductCategory.id).where(ProductCategory.slug == f.category)
                    ),
                )
            )
            stmt = stmt.where(Product.category_id.in_(cat_alias))
        if f.collection:
            stmt = stmt.where(
                Product.id.in_(
                    select(ProductCollection.product_id)
                    .join(Collection, Collection.id == ProductCollection.collection_id)
                    .where(Collection.slug == f.collection)
                )
            )
        if f.jewellery_type:
            stmt = stmt.where(Product.jewellery_type.in_([t.value for t in f.jewellery_type]))
        if f.metal_type:
            metals = [m.value for m in f.metal_type]
            stmt = stmt.where(
                or_(
                    Product.metal_type.in_(metals),
                    Product.id.in_(
                        select(ProductVariant.product_id).where(
                            ProductVariant.metal_type.in_(metals),
                            ProductVariant.is_active.is_(True),
                        )
                    ),
                )
            )
        if f.stone_type:
            stmt = stmt.where(Product.stone_type.in_([s.value for s in f.stone_type]))
        if f.gender:
            stmt = stmt.where(Product.gender.in_([f.gender.value, "unisex"]))
        if f.occasion:
            stmt = stmt.where(Product.occasions.any(literal(f.occasion.lower())))
        if f.style:
            stmt = stmt.where(Product.style == f.style.lower())
        price_expr = _price_expr()
        if f.min_price is not None:
            stmt = stmt.where(price_expr >= f.min_price)
        if f.max_price is not None:
            stmt = stmt.where(price_expr <= f.max_price)
        if f.tryon_only:
            stmt = stmt.where(Product.tryon_enabled.is_(True))
        if f.in_stock_only:
            stmt = stmt.where(or_(Product.stock_quantity > 0, Product.is_made_to_order.is_(True)))
        if f.featured is not None:
            stmt = stmt.where(Product.is_featured.is_(f.featured))
        if f.is_new is not None:
            stmt = stmt.where(Product.is_new.is_(f.is_new))
        return stmt

    def _apply_sort(self, stmt: Select[Product], f: ProductFilters) -> Select[Product]:
        price_expr = _price_expr()
        match f.sort:
            case "newest":
                return stmt.order_by(Product.created_at.desc())
            case "price_asc":
                return stmt.order_by(price_expr.asc(), Product.name)
            case "price_desc":
                return stmt.order_by(price_expr.desc(), Product.name)
            case "popular":
                return stmt.order_by(
                    (
                        Product.view_count + Product.tryon_count * 3 + Product.wishlist_count * 5
                    ).desc()
                )
            case _:
                if f.q:
                    return stmt.order_by(
                        func.similarity(Product.name, f.q.strip()).desc(),
                        Product.is_featured.desc(),
                    )
                return stmt.order_by(Product.is_featured.desc(), Product.created_at.desc())

    async def list_products(
        self, f: ProductFilters, *, include_inactive: bool = False
    ) -> tuple[list[Product], int]:
        stmt = self._apply_filters(self._base_query(include_inactive), f)
        count_stmt = select(func.count()).select_from(stmt.order_by(None).options().subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()
        stmt = self._apply_sort(stmt, f).offset((f.page - 1) * f.page_size).limit(f.page_size)
        products = list((await self.db.execute(stmt)).scalars().unique().all())
        return products, total

    async def get_product_by_slug(self, slug: str, *, include_inactive: bool = False) -> Product:
        stmt = self._base_query(include_inactive).where(Product.slug == slug)
        product = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if product is None:
            raise NotFoundError("This piece is no longer available.", code="product_not_found")
        return product

    async def get_product(
        self, product_id: uuid.UUID, *, include_inactive: bool = True, refresh: bool = False
    ) -> Product:
        stmt = self._base_query(include_inactive).where(Product.id == product_id)
        if refresh:
            stmt = stmt.execution_options(populate_existing=True)
        product = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if product is None:
            raise NotFoundError("This piece is no longer available.", code="product_not_found")
        return product

    async def get_products_by_ids(
        self, ids: list[uuid.UUID], *, include_inactive: bool = False
    ) -> list[Product]:
        if not ids:
            return []
        stmt = self._base_query(include_inactive).where(Product.id.in_(ids))
        return list((await self.db.execute(stmt)).scalars().unique().all())

    async def record_view(self, product: Product) -> None:
        product.view_count += 1

    # --- categories / collections -------------------------------------------------------

    async def list_categories(
        self, *, include_inactive: bool = False
    ) -> list[tuple[ProductCategory, int]]:
        count_sub = (
            select(Product.category_id, func.count(Product.id).label("n"))
            .where(Product.is_active.is_(True))
            .group_by(Product.category_id)
            .subquery()
        )
        stmt = (
            select(ProductCategory, func.coalesce(count_sub.c.n, 0))
            .outerjoin(count_sub, count_sub.c.category_id == ProductCategory.id)
            .order_by(ProductCategory.sort_order, ProductCategory.name)
        )
        if not include_inactive:
            stmt = stmt.where(ProductCategory.is_active.is_(True))
        rows = (await self.db.execute(stmt)).unique().all()
        return [(row[0], int(row[1])) for row in rows]

    async def get_category(self, category_id: uuid.UUID) -> ProductCategory:
        category = await self.db.get(ProductCategory, category_id)
        if category is None:
            raise NotFoundError(code="category_not_found")
        return category

    async def list_collections(
        self,
        *,
        featured: bool | None = None,
        bridal: bool | None = None,
        include_inactive: bool = False,
    ) -> list[tuple[Collection, int]]:
        count_sub = (
            select(
                ProductCollection.collection_id, func.count(ProductCollection.product_id).label("n")
            )
            .join(Product, Product.id == ProductCollection.product_id)
            .where(Product.is_active.is_(True))
            .group_by(ProductCollection.collection_id)
            .subquery()
        )
        stmt = (
            select(Collection, func.coalesce(count_sub.c.n, 0))
            .outerjoin(count_sub, count_sub.c.collection_id == Collection.id)
            .order_by(Collection.sort_order, Collection.name)
        )
        if not include_inactive:
            stmt = stmt.where(Collection.is_active.is_(True))
        if featured is not None:
            stmt = stmt.where(Collection.is_featured.is_(featured))
        if bridal is not None:
            stmt = stmt.where(Collection.is_bridal.is_(bridal))
        rows = (await self.db.execute(stmt)).unique().all()
        return [(row[0], int(row[1])) for row in rows]

    async def get_collection_by_slug(
        self, slug: str, *, include_inactive: bool = False
    ) -> Collection:
        stmt = select(Collection).where(Collection.slug == slug)
        if not include_inactive:
            stmt = stmt.where(Collection.is_active.is_(True))
        collection = (await self.db.execute(stmt)).scalar_one_or_none()
        if collection is None:
            raise NotFoundError(code="collection_not_found")
        return collection

    async def get_collection(self, collection_id: uuid.UUID) -> Collection:
        collection = await self.db.get(Collection, collection_id)
        if collection is None:
            raise NotFoundError(code="collection_not_found")
        return collection

    # --- admin: products --------------------------------------------------------------------

    async def _unique_slug(self, base: str, *, exclude_id: uuid.UUID | None = None) -> str:
        slug = slugify(base, 170)
        candidate = slug
        n = 2
        while True:
            stmt = select(Product.id).where(Product.slug == candidate)
            if exclude_id:
                stmt = stmt.where(Product.id != exclude_id)
            if (await self.db.execute(stmt)).scalar_one_or_none() is None:
                return candidate
            candidate = f"{slug}-{n}"
            n += 1

    async def _ensure_sku_free(self, sku: str, exclude_id: uuid.UUID | None = None) -> None:
        stmt = select(Product.id).where(Product.sku == sku)
        if exclude_id:
            stmt = stmt.where(Product.id != exclude_id)
        if (await self.db.execute(stmt)).scalar_one_or_none() is not None:
            raise ConflictError("A product with this SKU already exists.", code="sku_taken")

    async def _sync_collections(self, product: Product, collection_ids: list[uuid.UUID]) -> None:
        if collection_ids:
            found = (
                (await self.db.execute(select(Collection).where(Collection.id.in_(collection_ids))))
                .scalars()
                .all()
            )
            if len(found) != len(set(collection_ids)):
                raise ValidationAppError(
                    "One or more collections do not exist.", code="collection_not_found"
                )
            product.collections = list(found)
        else:
            product.collections = []

    async def _sync_set_items(self, product: Product, component_ids: list[uuid.UUID]) -> None:
        if product.id in component_ids:
            raise ValidationAppError("A set cannot contain itself.", code="invalid_set")
        existing = {item.component_product_id: item for item in product.set_items}
        for cid in component_ids:
            if cid not in existing:
                if await self.db.get(Product, cid) is None:
                    raise ValidationAppError(
                        "One or more set components do not exist.", code="product_not_found"
                    )
                product.set_items.append(
                    ProductSetItem(set_product_id=product.id, component_product_id=cid)
                )
        for cid, item in existing.items():
            if cid not in component_ids:
                product.set_items.remove(item)

    def _sync_variants(self, product: Product, variants: list[ProductVariantIn]) -> None:
        keep: dict[uuid.UUID, ProductVariantIn] = {v.id: v for v in variants if v.id}
        for existing in list(product.variants):
            if existing.id not in keep:
                product.variants.remove(existing)
        seen = set()
        for data in variants:
            key = (data.metal_type.value, data.stone_type.value, data.purity)
            if key in seen:
                raise ValidationAppError(
                    "Duplicate variant configuration.", code="duplicate_variant"
                )
            seen.add(key)
            payload = data.model_dump(exclude={"id"})
            if data.id and data.id in keep:
                target = next(v for v in product.variants if v.id == data.id)
                for k, val in payload.items():
                    setattr(target, k, val)
            else:
                product.variants.append(ProductVariant(**payload))
        defaults = [v for v in product.variants if v.is_default]
        if product.variants and not defaults:
            product.variants[0].is_default = True

    def _sync_sizes(self, product: Product, sizes: list[ProductSizeIn]) -> None:
        keep = {s.id for s in sizes if s.id}
        for existing in list(product.sizes):
            if existing.id not in keep:
                product.sizes.remove(existing)
        labels = set()
        for data in sizes:
            if data.label in labels:
                raise ValidationAppError("Duplicate size label.", code="duplicate_size")
            labels.add(data.label)
            payload = data.model_dump(exclude={"id"})
            if data.id and data.id in keep:
                target = next(s for s in product.sizes if s.id == data.id)
                for k, val in payload.items():
                    setattr(target, k, val)
            else:
                product.sizes.append(ProductSize(**payload))

    async def create_product(self, data: ProductIn) -> Product:
        await self._ensure_sku_free(data.sku)
        await self.get_category(data.category_id)
        payload = data.model_dump(
            exclude={"collection_ids", "variants", "sizes", "set_item_ids", "slug"}
        )
        product = Product(
            **payload,
            slug=await self._unique_slug(data.slug or data.name),
            collections=[],
            variants=[],
            sizes=[],
            set_items=[],
            images=[],
            tryon_assets=[],
            model_3d_assets=[],
        )
        self.db.add(product)
        await self.db.flush()
        await self._sync_collections(product, data.collection_ids)
        self._sync_variants(product, data.variants)
        self._sync_sizes(product, data.sizes)
        await self._sync_set_items(product, data.set_item_ids)
        await self.db.flush()
        return await self.get_product(product.id)

    async def update_product(self, product_id: uuid.UUID, data: ProductUpdate) -> Product:
        product = await self.get_product(product_id)
        changes = data.model_dump(exclude_unset=True)
        if changes.get("sku"):
            await self._ensure_sku_free(changes["sku"], exclude_id=product.id)
        if changes.get("category_id"):
            await self.get_category(changes["category_id"])
        if changes.get("slug"):
            changes["slug"] = await self._unique_slug(changes["slug"], exclude_id=product.id)
        for key in ("collection_ids", "variants", "sizes", "set_item_ids"):
            changes.pop(key, None)
        for key, value in changes.items():
            if value is not None or key in {
                "short_description",
                "description",
                "purity",
                "style",
                "diamond_details",
            }:
                setattr(product, key, value)
        if data.collection_ids is not None:
            await self._sync_collections(product, data.collection_ids)
        if data.variants is not None:
            self._sync_variants(product, data.variants)
        if data.sizes is not None:
            self._sync_sizes(product, data.sizes)
        if data.set_item_ids is not None:
            await self._sync_set_items(product, data.set_item_ids)
        await self.db.flush()
        return await self.get_product(product_id, refresh=True)

    async def deactivate_product(self, product_id: uuid.UUID) -> Product:
        product = await self.get_product(product_id)
        product.is_active = False
        await self.db.flush()
        return product

    async def delete_product(self, product_id: uuid.UUID) -> None:
        """Hard delete is only allowed when nothing references the product commercially."""
        from app.models.commerce import OrderItem

        product = await self.get_product(product_id)
        referenced = (
            await self.db.execute(
                select(func.count())
                .select_from(OrderItem)
                .where(OrderItem.product_id == product.id)
            )
        ).scalar_one()
        if referenced:
            raise ConflictError(
                "This product has been ordered and cannot be deleted. Deactivate it instead.",
                code="product_referenced",
            )
        await self.db.delete(product)
        await self.db.flush()

    # --- admin: assets ------------------------------------------------------------------------

    async def add_image(
        self, product: Product, *, storage_key: str, width: int, height: int, meta: dict[str, Any]
    ) -> ProductImage:
        if meta.get("is_primary"):
            for img in product.images:
                img.is_primary = False
        image = ProductImage(
            product_id=product.id,
            storage_key=storage_key,
            width=width,
            height=height,
            created_at=datetime.now(UTC),
            is_primary=bool(meta.get("is_primary")) or not product.images,
            alt_text=meta.get("alt_text") or product.name,
            view=meta.get("view", "front"),
            variant_id=meta.get("variant_id"),
            sort_order=meta.get("sort_order", len(product.images)),
        )
        self.db.add(image)
        await self.db.flush()
        return image

    async def remove_image(self, product: Product, image_id: uuid.UUID) -> ProductImage:
        image = next((i for i in product.images if i.id == image_id), None)
        if image is None:
            raise NotFoundError(code="image_not_found")
        await self.db.delete(image)
        await self.db.flush()
        return image

    async def add_tryon_asset(
        self, product: Product, *, storage_key: str, width: int, height: int, meta: dict[str, Any]
    ) -> ProductTryOnAsset:
        for existing in product.tryon_assets:
            if existing.view == meta.get("view", "front") and existing.variant_id == meta.get(
                "variant_id"
            ):
                await self.db.delete(existing)
        asset = ProductTryOnAsset(
            product_id=product.id,
            storage_key=storage_key,
            width=width,
            height=height,
            created_at=datetime.now(UTC),
            view=meta.get("view", "front"),
            variant_id=meta.get("variant_id"),
            anchors=meta.get("anchors") or {},
            real_width_mm=meta.get("real_width_mm"),
            real_height_mm=meta.get("real_height_mm"),
        )
        self.db.add(asset)
        await self.db.flush()
        return asset

    async def remove_tryon_asset(self, product: Product, asset_id: uuid.UUID) -> ProductTryOnAsset:
        asset = next((a for a in product.tryon_assets if a.id == asset_id), None)
        if asset is None:
            raise NotFoundError(code="asset_not_found")
        await self.db.delete(asset)
        await self.db.flush()
        return asset

    async def add_model_3d(
        self, product: Product, *, storage_key: str, size: int, meta: dict[str, Any]
    ) -> Product3DAsset:
        if meta.get("is_primary", True):
            for existing in product.model_3d_assets:
                existing.is_primary = False
        asset = Product3DAsset(
            product_id=product.id,
            storage_key=storage_key,
            format="glb",
            file_size_bytes=size,
            created_at=datetime.now(UTC),
            scale=meta.get("scale", 1.0),
            material_overrides=meta.get("material_overrides"),
            variant_id=meta.get("variant_id"),
            is_primary=meta.get("is_primary", True),
        )
        self.db.add(asset)
        await self.db.flush()
        return asset

    async def remove_model_3d(self, product: Product, asset_id: uuid.UUID) -> Product3DAsset:
        asset = next((a for a in product.model_3d_assets if a.id == asset_id), None)
        if asset is None:
            raise NotFoundError(code="asset_not_found")
        await self.db.delete(asset)
        await self.db.flush()
        return asset

    # --- admin: categories / collections ---------------------------------------------------------

    async def create_category(self, data: CategoryIn) -> ProductCategory:
        slug = data.slug or slugify(data.name)
        if (
            await self.db.execute(select(ProductCategory.id).where(ProductCategory.slug == slug))
        ).scalar_one_or_none():
            raise ConflictError("A category with this slug already exists.", code="slug_taken")
        if data.parent_id:
            await self.get_category(data.parent_id)
        category = ProductCategory(**data.model_dump(exclude={"slug"}), slug=slug)
        self.db.add(category)
        await self.db.flush()
        return category

    async def update_category(self, category_id: uuid.UUID, data: CategoryIn) -> ProductCategory:
        category = await self.get_category(category_id)
        if data.parent_id == category.id:
            raise ValidationAppError("A category cannot be its own parent.", code="invalid_parent")
        for key, value in data.model_dump(exclude_unset=True).items():
            if key == "slug" and not value:
                continue
            setattr(category, key, value)
        await self.db.flush()
        return category

    async def create_collection(self, data: CollectionIn) -> Collection:
        slug = data.slug or slugify(data.name)
        if (
            await self.db.execute(select(Collection.id).where(Collection.slug == slug))
        ).scalar_one_or_none():
            raise ConflictError("A collection with this slug already exists.", code="slug_taken")
        collection = Collection(**data.model_dump(exclude={"slug", "product_ids"}), slug=slug)
        self.db.add(collection)
        await self.db.flush()
        if data.product_ids:
            await self._set_collection_products(collection, data.product_ids)
        return collection

    async def update_collection(self, collection_id: uuid.UUID, data: CollectionIn) -> Collection:
        collection = await self.get_collection(collection_id)
        for key, value in data.model_dump(exclude_unset=True, exclude={"product_ids"}).items():
            if key == "slug" and not value:
                continue
            setattr(collection, key, value)
        if data.product_ids is not None:
            await self._set_collection_products(collection, data.product_ids)
        await self.db.flush()
        return collection

    async def _set_collection_products(
        self, collection: Collection, product_ids: list[uuid.UUID]
    ) -> None:
        products = (
            (await self.db.execute(select(Product).where(Product.id.in_(product_ids))))
            .scalars()
            .unique()
            .all()
        )
        if len(products) != len(set(product_ids)):
            raise ValidationAppError("One or more products do not exist.", code="product_not_found")
        collection.products = list(products)
        await self.db.flush()
