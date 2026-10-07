from __future__ import annotations

import uuid

from fastapi import APIRouter, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import DBDep, OptionalUserDep, SessionTokenDep, SettingsDep, StorageDep
from app.core.settings import Settings
from app.models.commerce import Cart
from app.models.user import User
from app.schemas.commerce import CartItemIn, CartItemOut, CartItemUpdate, CartOut
from app.services.commerce_service import CartService, item_available, money, unit_price
from app.services.serializers import product_summary_out, size_out, variant_out
from app.storage import ObjectStorage

router = APIRouter(prefix="/cart", tags=["cart"])


def cart_out(cart: Cart, service: CartService, storage: ObjectStorage) -> CartOut:
    items = []
    for item in cart.items:
        price = unit_price(item.product, item.variant, item.size)
        items.append(
            CartItemOut(
                id=item.id,
                product=product_summary_out(item.product, storage),
                variant=variant_out(item.variant, item.product.price) if item.variant else None,
                size=size_out(item.size) if item.size else None,
                quantity=item.quantity,
                unit_price=price,
                line_total=money(price * item.quantity),
                available=item_available(item.product, item.variant, item.size, item.quantity),
            )
        )
    subtotal, tax, grand = service.totals(cart)
    return CartOut(
        id=cart.id,
        items=items,
        subtotal=subtotal,
        tax_total=tax,
        grand_total=grand,
        currency=service.settings.currency,
        item_count=sum(i.quantity for i in cart.items),
    )


async def _cart(
    request: Request,
    response: Response,
    user: User | None,
    session_token: str | None,
    db: AsyncSession,
    settings: Settings,
) -> tuple[Cart, CartService, str | None]:
    from app.api.v1.tryon import resolve_owner

    owner = await resolve_owner(request, response, user, session_token, db)
    customer = user.customer if user else None
    service = CartService(db, settings)
    cart = await service.get_or_create(customer, owner.session_token)
    return cart, service, owner.session_token


@router.get("", response_model=CartOut)
async def get_cart(
    request: Request,
    response: Response,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> CartOut:
    cart, service, _ = await _cart(request, response, user, session_token, db, settings)
    return cart_out(cart, service, storage)


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
async def add_item(
    request: Request,
    response: Response,
    data: CartItemIn,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> CartOut:
    cart, service, token = await _cart(request, response, user, session_token, db, settings)
    customer_id = user.customer.id if user and user.customer else None
    cart = await service.add(cart, data, customer_id=customer_id, session_token=token)
    return cart_out(cart, service, storage)


@router.patch("/items/{item_id}", response_model=CartOut)
async def update_item(
    request: Request,
    response: Response,
    item_id: uuid.UUID,
    data: CartItemUpdate,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> CartOut:
    cart, service, _ = await _cart(request, response, user, session_token, db, settings)
    cart = await service.update(cart, item_id, data.quantity)
    return cart_out(cart, service, storage)


@router.delete("/items/{item_id}", response_model=CartOut)
async def remove_item(
    request: Request,
    response: Response,
    item_id: uuid.UUID,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> CartOut:
    cart, service, _ = await _cart(request, response, user, session_token, db, settings)
    cart = await service.update(cart, item_id, 0)
    return cart_out(cart, service, storage)
