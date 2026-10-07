"""Operational command line: ``python -m app.cli <command>``.

Commands
--------
seed              Load development seed data (refuses to run when APP_ENV=production).
create-admin      Create an admin user (pass --email and --password).
index-embeddings  Compute visual-search embeddings for every product image.
cleanup           Purge expired customer photos, stale tokens and abandoned guest carts.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import configure_logging, get_logger
from app.core.settings import REPO_DIR, get_settings
from app.db.session import get_session_factory
from app.models.catalogue import Collection, Product, ProductCategory
from app.models.enums import Role
from app.models.user import Store, User
from app.schemas.catalogue import ProductIn
from app.services.auth_service import AuthService
from app.services.catalogue_service import CatalogueService
from app.storage import get_storage
from app.storage.base import product_image_key, product_model_key, product_tryon_asset_key

log = get_logger("cli")

SEED_FILE = REPO_DIR / "database" / "seeds" / "catalogue.json"
GENERATED_DIR = REPO_DIR / "database" / "seeds" / ".generated"

DEV_ACCOUNTS = [
    ("admin@jewelora-demo.com", "Admin#12345", "Jewelora Admin", [Role.ADMIN]),
    ("manager@jewelora-demo.com", "Manager#12345", "Store Manager", [Role.MANAGER]),
    ("sales@jewelora-demo.com", "Sales#12345", "Sales Associate", [Role.SALES_STAFF]),
]
DEV_CUSTOMER = ("customer@jewelora-demo.com", "Customer#12345", "Priya Raman")


def _dev_assets_module() -> Any:
    sys.path.insert(0, str(REPO_DIR))
    from scripts.dev_assets import render2d, render3d

    return render2d, render3d


class _AssetFactory:
    """Renders (and caches) development assets for a product + metal + gem combination."""

    def __init__(self) -> None:
        self.render2d, self.render3d = _dev_assets_module()
        GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    def _cached(self, name: str, build: Any) -> Path:
        path = GENERATED_DIR / name
        if not path.exists():
            build(path)
        return path

    def tryon(
        self, jewellery_type: str, metal: str, gem: str, style: str | None
    ) -> tuple[Path, dict[str, Any]]:
        key = f"{jewellery_type}-{style or 'default'}-{metal}-{gem}"
        meta_path = GENERATED_DIR / f"{key}.json"
        renderer = (
            self.render2d.RENDERERS.get(jewellery_type) or self.render2d.RENDERERS["necklace"]
        )

        def build(path: Path) -> None:
            result = renderer(metal, gem, style=style) if style else renderer(metal, gem)
            result.image.save(path, format="PNG", optimize=True)
            meta_path.write_text(
                json.dumps(
                    {
                        "anchors": result.anchors,
                        "real_width_mm": result.real_width_mm,
                        "real_height_mm": result.real_height_mm,
                        "width": result.image.width,
                        "height": result.image.height,
                    }
                )
            )

        path = self._cached(f"{key}.png", build)
        return path, json.loads(meta_path.read_text())

    def photo(
        self, jewellery_type: str, metal: str, gem: str, style: str | None, *, dark: bool = False
    ) -> Path:
        tone = "dark" if dark else "light"
        key = f"{jewellery_type}-{style or 'default'}-{metal}-{gem}-{tone}-photo"

        def build(path: Path) -> None:
            from PIL import Image

            if jewellery_type == "ring":
                asset = self.render2d.render_ring_photo(metal, gem, style=style or "solitaire")
            else:
                asset_path, _ = self.tryon(jewellery_type, metal, gem, style)
                asset = Image.open(asset_path).convert("RGBA")
            bg = (46, 40, 36) if dark else (247, 243, 236)
            self.render2d.render_product_photo(asset, background=bg).save(
                path, format="JPEG", quality=90
            )

        return self._cached(f"{key}.jpg", build)

    def model(self, jewellery_type: str, metal: str, gem: str, style: str | None) -> Path | None:
        builder = self.render3d.BUILDERS.get(jewellery_type)
        if builder is None:
            return None
        key = f"{jewellery_type}-{style or 'default'}-{metal}-{gem}.glb"

        def build(path: Path) -> None:
            scene = builder(metal, gem, style) if style else builder(metal, gem)
            path.write_bytes(self.render3d.export_glb(scene))

        return self._cached(key, build)


async def _seed_accounts(db: AsyncSession) -> None:
    settings = get_settings()
    auth = AuthService(db, settings)
    for email, password, name, roles in DEV_ACCOUNTS:
        if await auth.find_by_identifier(email) is None:
            await auth.create_staff_user(
                full_name=name, email=email, password=password, roles=roles
            )
            log.info("seed_account_created", email=email, roles=[r.value for r in roles])
    email, password, name = DEV_CUSTOMER
    if await auth.find_by_identifier(email) is None:
        from app.schemas.auth import RegisterRequest

        await auth.register_customer(
            RegisterRequest(full_name=name, email=email, password=password)
        )
        log.info("seed_account_created", email=email, roles=["customer"])


async def _seed_stores(db: AsyncSession, stores: list[dict[str, Any]]) -> None:
    for data in stores:
        exists = (
            await db.execute(select(Store).where(Store.slug == data["slug"]))
        ).scalar_one_or_none()
        if exists is None:
            db.add(Store(**data))
    await db.flush()


async def _seed_categories(
    db: AsyncSession, categories: list[dict[str, Any]]
) -> dict[str, ProductCategory]:
    by_slug: dict[str, ProductCategory] = {}
    for data in categories:
        existing = (
            await db.execute(select(ProductCategory).where(ProductCategory.slug == data["slug"]))
        ).scalar_one_or_none()
        if existing is None:
            payload = {k: v for k, v in data.items() if k != "parent"}
            existing = ProductCategory(**payload)
            db.add(existing)
            await db.flush()
        by_slug[data["slug"]] = existing
    for data in categories:
        if data.get("parent"):
            by_slug[data["slug"]].parent_id = by_slug[data["parent"]].id
    await db.flush()
    return by_slug


async def _seed_collections(
    db: AsyncSession, collections: list[dict[str, Any]]
) -> dict[str, Collection]:
    by_slug: dict[str, Collection] = {}
    for data in collections:
        existing = (
            await db.execute(select(Collection).where(Collection.slug == data["slug"]))
        ).scalar_one_or_none()
        if existing is None:
            existing = Collection(**data)
            db.add(existing)
            await db.flush()
        by_slug[data["slug"]] = existing
    return by_slug


async def _seed_products(
    db: AsyncSession,
    products: list[dict[str, Any]],
    categories: dict[str, ProductCategory],
    collections: dict[str, Collection],
    *,
    with_assets: bool,
) -> None:
    service = CatalogueService(db)
    storage = get_storage()
    settings = get_settings()
    assets = _AssetFactory() if with_assets else None
    created: dict[str, Product] = {}
    deferred_sets: list[tuple[str, list[str]]] = []

    for data in products:
        existing = (
            await db.execute(select(Product).where(Product.sku == data["sku"]))
        ).scalar_one_or_none()
        if existing is not None:
            created[data["sku"]] = existing
            continue
        render = data.get("render", {})
        set_items = data.get("set_items", [])
        payload = {
            k: v
            for k, v in data.items()
            if k not in {"category", "collections", "render", "with_3d", "set_items"}
        }
        payload["category_id"] = categories[data["category"]].id
        payload["collection_ids"] = [collections[s].id for s in data.get("collections", [])]
        payload["tryon_enabled"] = data["jewellery_type"] != "set"
        product = await service.create_product(ProductIn.model_validate(payload))
        created[data["sku"]] = product
        if set_items:
            deferred_sets.append((data["sku"], set_items))
        if assets is None:
            continue

        gem = render.get("gem", "none")
        style = render.get("style")
        jtype = data["jewellery_type"] if data["jewellery_type"] != "set" else "necklace"
        metals: list[tuple[str, uuid.UUID | None]] = []
        for variant in product.variants:
            if variant.metal_type not in {m for m, _ in metals}:
                metals.append((variant.metal_type, variant.id))
        if not metals:
            metals = [(product.metal_type, None)]

        for index, (metal, variant_id) in enumerate(metals):
            light = assets.photo(jtype, metal, gem, style)
            await _upload_image(
                service,
                storage,
                settings,
                product,
                light,
                variant_id,
                primary=index == 0,
                sort=index * 2,
            )
            if index == 0:
                dark = assets.photo(jtype, metal, gem, style, dark=True)
                await _upload_image(
                    service,
                    storage,
                    settings,
                    product,
                    dark,
                    None,
                    primary=False,
                    sort=1,
                    view="angle",
                )
            if data["jewellery_type"] != "set":
                path, meta = assets.tryon(jtype, metal, gem, style)
                from app.services.upload_service import process_image

                processed = process_image(
                    path.read_bytes(),
                    settings,
                    max_bytes=settings.product_asset_max_bytes,
                    keep_alpha=True,
                    quality=95,
                )
                key = product_tryon_asset_key(str(product.id), processed.extension)
                await storage.put(key, processed.data, processed.content_type)
                await service.add_tryon_asset(
                    product,
                    storage_key=key,
                    width=processed.width,
                    height=processed.height,
                    meta={
                        "view": "front",
                        "variant_id": variant_id if len(metals) > 1 else None,
                        "anchors": meta["anchors"],
                        "real_width_mm": Decimal(str(meta["real_width_mm"])),
                        "real_height_mm": Decimal(str(meta["real_height_mm"])),
                    },
                )
            if data.get("with_3d"):
                model_path = assets.model(jtype, metal, gem, style)
                if model_path is not None:
                    glb = model_path.read_bytes()
                    key = product_model_key(str(product.id), "glb")
                    await storage.put(key, glb, "model/gltf-binary")
                    await service.add_model_3d(
                        product,
                        storage_key=key,
                        size=len(glb),
                        meta={
                            "scale": 1.0,
                            "variant_id": variant_id if len(metals) > 1 else None,
                            "is_primary": index == 0,
                        },
                    )
        log.info("seed_product_created", sku=product.sku, name=product.name)

    for sku, component_skus in deferred_sets:
        product = created[sku]
        for component_sku in component_skus:
            component = created.get(component_sku)
            if component is None:
                continue
            from app.models.catalogue import ProductSetItem

            if not any(i.component_product_id == component.id for i in product.set_items):
                db.add(ProductSetItem(set_product_id=product.id, component_product_id=component.id))
    await db.flush()


async def _upload_image(
    service: CatalogueService,
    storage: Any,
    settings: Any,
    product: Product,
    path: Path,
    variant_id: uuid.UUID | None,
    *,
    primary: bool,
    sort: int,
    view: str = "front",
) -> None:
    from app.services.upload_service import process_image

    processed = process_image(
        await asyncio.to_thread(path.read_bytes), settings, max_dimension=1600
    )
    key = product_image_key(str(product.id), processed.extension)
    await storage.put(key, processed.data, processed.content_type)
    await service.add_image(
        product,
        storage_key=key,
        width=processed.width,
        height=processed.height,
        meta={
            "is_primary": primary,
            "alt_text": product.name,
            "view": view,
            "variant_id": variant_id,
            "sort_order": sort,
        },
    )


async def seed(*, with_assets: bool = True) -> None:
    settings = get_settings()
    if settings.is_production:
        raise SystemExit("Refusing to seed development data into a production environment.")
    data = json.loads(SEED_FILE.read_text())
    factory = get_session_factory()
    async with factory() as db:
        await _seed_accounts(db)
        await _seed_stores(db, data["stores"])
        categories = await _seed_categories(db, data["categories"])
        collections = await _seed_collections(db, data["collections"])
        await db.commit()
    async with factory() as db:
        categories = {c.slug: c for c in (await db.execute(select(ProductCategory))).scalars()}
        collections = {c.slug: c for c in (await db.execute(select(Collection))).scalars()}
        await _seed_products(db, data["products"], categories, collections, with_assets=with_assets)
        await db.commit()
    count = len(data["products"])
    print(
        f"Seed complete: {count} products, {len(data['categories'])} categories, "
        f"{len(data['collections'])} collections."
    )
    print("Development accounts:")
    for email, password, _, roles in DEV_ACCOUNTS:
        print(f"  {roles[0].value:<12} {email:<28} {password}")
    print(f"  {'customer':<12} {DEV_CUSTOMER[0]:<28} {DEV_CUSTOMER[1]}")


async def create_admin(email: str, password: str, full_name: str) -> None:
    factory = get_session_factory()
    async with factory() as db:
        auth = AuthService(db, get_settings())
        existing = await auth.find_by_identifier(email)
        if existing is not None:
            raise SystemExit("A user with that email already exists.")
        user: User = await auth.create_staff_user(
            full_name=full_name, email=email, password=password, roles=[Role.ADMIN]
        )
        await db.commit()
        print(f"Admin created: {user.email}")


async def index_embeddings() -> None:
    from app.services.visual_search_service import VisualSearchService

    settings = get_settings()
    factory = get_session_factory()
    async with factory() as db:
        count = await VisualSearchService(db, get_storage(), settings).index_all()
        await db.commit()
    print(f"Indexed {count} product images for visual search.")


async def cleanup() -> None:
    from app.tasks.maintenance import run_cleanup

    settings = get_settings()
    factory = get_session_factory()
    async with factory() as db:
        result = await run_cleanup(db, get_storage(), settings)
        await db.commit()
    print(f"Cleanup complete: {result}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="jewelora", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)
    seed_cmd = sub.add_parser("seed", help="load development seed data")
    seed_cmd.add_argument(
        "--no-assets", action="store_true", help="skip image/3D asset generation (faster, for CI)"
    )
    admin_cmd = sub.add_parser("create-admin", help="create an admin user")
    admin_cmd.add_argument("--email", required=True)
    admin_cmd.add_argument("--password", required=True)
    admin_cmd.add_argument("--name", default="Administrator")
    sub.add_parser("index-embeddings", help="compute visual search embeddings for product images")
    sub.add_parser("cleanup", help="purge expired photos, stale tokens and abandoned guest carts")
    args = parser.parse_args(argv)
    configure_logging(get_settings())
    if args.command == "seed":
        asyncio.run(seed(with_assets=not args.no_assets))
    elif args.command == "create-admin":
        asyncio.run(create_admin(args.email, args.password, args.name))
    elif args.command == "index-embeddings":
        asyncio.run(index_embeddings())
    elif args.command == "cleanup":
        asyncio.run(cleanup())


if __name__ == "__main__":
    main()
