"""Carts, orders and payments."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.settings import Settings
from app.integrations.payments import PaymentProvider
from app.models.catalogue import Product, ProductSize, ProductVariant
from app.models.commerce import Cart, CartItem, Order, OrderItem, Payment
from app.models.enums import AnalyticsEventType, OrderStatus, PaymentMethod, PaymentStatus
from app.models.user import Customer, Store
from app.schemas.commerce import CartItemIn, OrderIn
from app.services.analytics_service import record_event
from app.services.catalogue_service import PRODUCT_LOAD_OPTIONS
from app.services.references import order_number

CART_OPTIONS = (
    selectinload(Cart.items).selectinload(CartItem.product).options(*PRODUCT_LOAD_OPTIONS),
    selectinload(Cart.items).selectinload(CartItem.variant),
    selectinload(Cart.items).selectinload(CartItem.size),
)
ORDER_OPTIONS = (selectinload(Order.items), selectinload(Order.payments), selectinload(Order.store))


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def unit_price(
    product: Product, variant: ProductVariant | None, size: ProductSize | None
) -> Decimal:
    price = product.price
    if variant:
        price += variant.price_delta
    if size:
        price += size.price_delta
    return money(price)


def item_available(
    product: Product, variant: ProductVariant | None, size: ProductSize | None, quantity: int
) -> bool:
    if not product.is_active:
        return False
    if product.is_made_to_order:
        return True
    stock = product.stock_quantity
    if variant and variant.stock_quantity:
        stock = variant.stock_quantity
    if size and size.stock_quantity:
        stock = min(stock, size.stock_quantity) if stock else size.stock_quantity
    return stock >= quantity


def _same_line(a: CartItem, b: CartItem) -> bool:
    return (a.product_id, a.variant_id, a.size_id) == (b.product_id, b.variant_id, b.size_id)


class CartService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    async def _load(self, cart_id: uuid.UUID) -> Cart:
        stmt = select(Cart).options(*CART_OPTIONS).where(Cart.id == cart_id)
        return (
            (await self.db.execute(stmt.execution_options(populate_existing=True)))
            .scalars()
            .unique()
            .one()
        )

    async def _find(self, **where: object) -> Cart | None:
        stmt = select(Cart).options(*CART_OPTIONS).filter_by(**where)
        result = await self.db.execute(stmt.execution_options(populate_existing=True))
        return result.scalars().unique().one_or_none()

    async def get_or_create(self, customer: Customer | None, session_token: str | None) -> Cart:
        if customer is None and not session_token:
            raise ValidationAppError(
                "Your browser session could not be identified.", code="no_session"
            )
        cart: Cart | None = None
        if customer is not None:
            cart = await self._find(customer_id=customer.id)
            guest = await self._find(session_token=session_token) if session_token else None
            if guest is not None:
                cart = await self._merge(guest, cart, customer)
        elif session_token:
            cart = await self._find(session_token=session_token)
        if cart is None:
            cart = Cart(
                customer_id=customer.id if customer else None,
                session_token=None if customer else session_token,
                items=[],
            )
            self.db.add(cart)
            await self.db.flush()
        return cart

    async def _merge(self, guest: Cart, owned: Cart | None, customer: Customer) -> Cart:
        """Move a guest cart's items into the customer's cart on sign-in."""
        if owned is None:
            guest.customer_id = customer.id
            guest.session_token = None
            await self.db.flush()
            return guest
        for item in list(guest.items):
            match = next((i for i in owned.items if _same_line(i, item)), None)
            if match:
                match.quantity = min(10, match.quantity + item.quantity)
            else:
                owned.items.append(
                    CartItem(
                        product_id=item.product_id,
                        variant_id=item.variant_id,
                        size_id=item.size_id,
                        quantity=item.quantity,
                        created_at=datetime.now(UTC),
                    )
                )
        await self.db.delete(guest)
        await self.db.flush()
        return await self._load(owned.id)

    async def add(
        self,
        cart: Cart,
        data: CartItemIn,
        *,
        customer_id: uuid.UUID | None,
        session_token: str | None,
    ) -> Cart:
        stmt = (
            select(Product)
            .options(*PRODUCT_LOAD_OPTIONS)
            .where(Product.id == data.product_id, Product.is_active.is_(True))
        )
        product = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if product is None:
            raise NotFoundError("This piece is no longer available.", code="product_not_found")
        variant = None
        if data.variant_id:
            variant = next(
                (v for v in product.variants if v.id == data.variant_id and v.is_active), None
            )
            if variant is None:
                raise ValidationAppError(
                    "That variation isn't available for this piece.", code="variant_not_found"
                )
        size = None
        if data.size_id:
            size = next((s for s in product.sizes if s.id == data.size_id), None)
            if size is None:
                raise ValidationAppError(
                    "That size isn't available for this piece.", code="size_not_found"
                )
        if product.sizes and size is None:
            raise ValidationAppError("Please choose a size.", code="size_required")
        if not item_available(product, variant, size, data.quantity):
            raise ConflictError(
                "Sorry, this piece is out of stock in that configuration.", code="out_of_stock"
            )
        new_line = CartItem(
            product_id=product.id,
            variant_id=data.variant_id,
            size_id=data.size_id,
            quantity=data.quantity,
            created_at=datetime.now(UTC),
        )
        existing = next((i for i in cart.items if _same_line(i, new_line)), None)
        if existing:
            existing.quantity = min(10, existing.quantity + data.quantity)
        else:
            cart.items.append(new_line)
        await self.db.flush()
        await record_event(
            self.db,
            AnalyticsEventType.PRODUCT_ADD_TO_CART,
            product_id=product.id,
            customer_id=customer_id,
            session_token=session_token,
        )
        return await self._load(cart.id)

    async def update(self, cart: Cart, item_id: uuid.UUID, quantity: int) -> Cart:
        item = next((i for i in cart.items if i.id == item_id), None)
        if item is None:
            raise NotFoundError(code="item_not_found")
        if quantity == 0:
            cart.items.remove(item)  # delete-orphan cascade removes the row
        else:
            item.quantity = quantity
        await self.db.flush()
        return await self._load(cart.id)

    async def clear(self, cart: Cart) -> None:
        cart.items.clear()  # delete-orphan cascade removes the rows
        await self.db.flush()

    def totals(self, cart: Cart) -> tuple[Decimal, Decimal, Decimal]:
        subtotal = sum(
            (
                unit_price(i.product, i.variant, i.size) * i.quantity
                for i in cart.items
                if i.product.is_active
            ),
            Decimal("0"),
        )
        tax = money(subtotal * Decimal(str(self.settings.gst_rate_percent)) / Decimal(100))
        return money(subtotal), tax, money(subtotal + tax)


class OrderService:
    def __init__(self, db: AsyncSession, settings: Settings, provider: PaymentProvider) -> None:
        self.db = db
        self.settings = settings
        self.provider = provider

    async def _load(self, order_id: uuid.UUID) -> Order:
        stmt = select(Order).options(*ORDER_OPTIONS).where(Order.id == order_id)
        return (
            (await self.db.execute(stmt.execution_options(populate_existing=True)))
            .scalars()
            .unique()
            .one()
        )

    def _snapshot(self, item: CartItem) -> OrderItem:
        price = unit_price(item.product, item.variant, item.size)
        images = item.product.images
        primary = next((img for img in images if img.is_primary), images[0] if images else None)
        variant_label = None
        if item.variant:
            variant_label = f"{item.variant.metal_type} {item.variant.purity or ''}".strip()
        return OrderItem(
            product_id=item.product_id,
            variant_id=item.variant_id,
            size_id=item.size_id,
            sku=f"{item.product.sku}-{item.variant.sku_suffix}"
            if item.variant
            else item.product.sku,
            name=item.product.name,
            variant_label=variant_label,
            size_label=item.size.label if item.size else None,
            image_key=primary.storage_key if primary else None,
            unit_price=price,
            quantity=item.quantity,
            line_total=money(price * item.quantity),
        )

    @staticmethod
    def _reserve_stock(item: CartItem) -> None:
        if item.product.is_made_to_order:
            return
        if item.variant and item.variant.stock_quantity:
            item.variant.stock_quantity = max(0, item.variant.stock_quantity - item.quantity)
        if item.size and item.size.stock_quantity:
            item.size.stock_quantity = max(0, item.size.stock_quantity - item.quantity)
        item.product.stock_quantity = max(0, item.product.stock_quantity - item.quantity)

    async def place(
        self,
        customer: Customer,
        cart: Cart,
        data: OrderIn,
        *,
        session_token: str | None,
        user_agent: str | None,
    ) -> Order:
        items = [i for i in cart.items if i.product.is_active]
        if not items:
            raise ValidationAppError("Your cart is empty.", code="cart_empty")
        for item in items:
            if not item_available(item.product, item.variant, item.size, item.quantity):
                raise ConflictError(
                    f"{item.product.name} is no longer available in that configuration.",
                    code="out_of_stock",
                )
        store = None
        if data.store_id:
            store = await self.db.get(Store, data.store_id)
            if store is None or not store.is_active:
                raise NotFoundError(code="store_not_found")
        online = data.payment_method == PaymentMethod.RAZORPAY
        if online and self.provider.name != "razorpay":
            raise ValidationAppError(
                "Online payment isn't enabled yet. Please choose another payment method.",
                code="payment_method_unavailable",
            )
        cart_service = CartService(self.db, self.settings)
        subtotal, tax, grand = cart_service.totals(cart)
        order = Order(
            customer_id=customer.id,
            order_number=order_number(),
            status=OrderStatus.AWAITING_PAYMENT.value if online else OrderStatus.PENDING.value,
            fulfilment_method=data.fulfilment_method.value,
            store_id=store.id if store else None,
            payment_method=data.payment_method.value,
            currency=self.settings.currency,
            subtotal=subtotal,
            tax_total=tax,
            shipping_total=Decimal("0"),
            grand_total=grand,
            shipping_address=data.shipping_address.model_dump() if data.shipping_address else None,
            contact_name=data.contact_name,
            contact_phone=data.contact_phone,
            contact_email=str(data.contact_email).lower() if data.contact_email else None,
            customer_notes=data.customer_notes,
            placed_at=datetime.now(UTC),
            items=[],
            payments=[],
        )
        self.db.add(order)
        await self.db.flush()
        for item in items:
            order.items.append(self._snapshot(item))
            self._reserve_stock(item)
            await record_event(
                self.db,
                AnalyticsEventType.PRODUCT_PURCHASE,
                product_id=item.product_id,
                customer_id=customer.id,
                session_token=session_token,
                properties={
                    "order": order.order_number,
                    "quantity": item.quantity,
                    "status": order.status,
                },
                user_agent=user_agent,
            )
        if online:
            provider_order = await self.provider.create_order(
                amount=order.grand_total,
                currency=order.currency,
                receipt=order.order_number,
                notes={"order_number": order.order_number},
            )
            order.payments.append(
                Payment(
                    provider=provider_order.provider,
                    provider_order_id=provider_order.provider_order_id,
                    status=PaymentStatus.CREATED.value,
                    amount=order.grand_total,
                    currency=order.currency,
                    raw_response=provider_order.raw,
                )
            )
        else:
            order.payments.append(
                Payment(
                    provider="none",
                    status=PaymentStatus.CREATED.value,
                    amount=order.grand_total,
                    currency=order.currency,
                )
            )
        await cart_service.clear(cart)
        await self.db.flush()
        return await self._load(order.id)

    async def list_mine(self, customer: Customer) -> list[Order]:
        stmt = (
            select(Order)
            .options(*ORDER_OPTIONS)
            .where(Order.customer_id == customer.id)
            .order_by(Order.placed_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().unique().all())

    async def get_mine(self, customer: Customer, order_id: uuid.UUID) -> Order:
        stmt = (
            select(Order)
            .options(*ORDER_OPTIONS)
            .where(Order.id == order_id, Order.customer_id == customer.id)
        )
        order = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if order is None:
            raise NotFoundError(code="order_not_found")
        return order

    async def confirm_online_payment(
        self,
        customer: Customer,
        order_id: uuid.UUID,
        *,
        provider_order_id: str,
        provider_payment_id: str,
        signature: str,
    ) -> Order:
        order = await self.get_mine(customer, order_id)
        payment = next(
            (p for p in order.payments if p.provider_order_id == provider_order_id), None
        )
        if payment is None:
            raise NotFoundError(code="payment_not_found")
        verified = self.provider.verify_payment(
            provider_order_id=provider_order_id,
            provider_payment_id=provider_payment_id,
            signature=signature,
        )
        if not verified:
            payment.status = PaymentStatus.FAILED.value
            payment.failure_reason = "signature mismatch"
            await self.db.flush()
            raise ValidationAppError(
                "We couldn't verify that payment. Please contact the store.",
                code="payment_unverified",
            )
        payment.status = PaymentStatus.CAPTURED.value
        payment.provider_payment_id = provider_payment_id
        order.status = OrderStatus.PAID.value
        order.paid_at = datetime.now(UTC)
        await self.db.flush()
        return await self._load(order.id)

    async def cancel_mine(self, customer: Customer, order_id: uuid.UUID) -> Order:
        order = await self.get_mine(customer, order_id)
        if order.status not in {OrderStatus.PENDING.value, OrderStatus.AWAITING_PAYMENT.value}:
            raise ConflictError(
                "This order can no longer be cancelled online. Please contact the store.",
                code="not_cancellable",
            )
        order.status = OrderStatus.CANCELLED.value
        order.cancelled_at = datetime.now(UTC)
        for item in order.items:
            if item.product_id:
                product = await self.db.get(Product, item.product_id)
                if product and not product.is_made_to_order:
                    product.stock_quantity += item.quantity
        await self.db.flush()
        return await self._load(order.id)
