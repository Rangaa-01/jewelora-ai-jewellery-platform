from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Header, Request, Response, status
from sqlalchemy import select

from app.core.deps import (
    CurrentCustomerDep,
    DBDep,
    OptionalUserDep,
    SessionTokenDep,
    SettingsDep,
    StorageDep,
)
from app.core.errors import AuthorizationError
from app.core.logging import get_logger
from app.core.rate_limit import PUBLIC_FORM_LIMIT, limiter
from app.integrations.payments import build_payment_provider
from app.models.commerce import Order, Payment
from app.models.enums import OrderStatus, PaymentStatus
from app.schemas.commerce import OrderIn, OrderItemOut, OrderOut, PaymentConfirmIn, PaymentOut
from app.schemas.common import Message
from app.services.commerce_service import CartService, OrderService
from app.storage import ObjectStorage, url_for_key

log = get_logger(__name__)
router = APIRouter(prefix="/orders", tags=["orders"])


def order_out(order: Order, storage: ObjectStorage) -> OrderOut:
    payment = order.payments[-1] if order.payments else None
    checkout = None
    if (
        payment
        and payment.provider == "razorpay"
        and payment.status == PaymentStatus.CREATED.value
        and payment.raw_response
    ):
        checkout = {
            "key_id": None,  # filled by the router from settings (never stored)
            "order_id": payment.provider_order_id,
            "amount": payment.raw_response.get("amount"),
            "currency": payment.currency,
        }
    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        fulfilment_method=order.fulfilment_method,
        store_id=order.store_id,
        store_name=order.store.name if order.store else None,
        payment_method=order.payment_method,
        currency=order.currency,
        subtotal=order.subtotal,
        discount_total=order.discount_total,
        tax_total=order.tax_total,
        shipping_total=order.shipping_total,
        grand_total=order.grand_total,
        shipping_address=order.shipping_address,
        contact_name=order.contact_name,
        contact_phone=order.contact_phone,
        contact_email=order.contact_email,
        customer_notes=order.customer_notes,
        items=[
            OrderItemOut(
                id=i.id,
                product_id=i.product_id,
                sku=i.sku,
                name=i.name,
                variant_label=i.variant_label,
                size_label=i.size_label,
                image_url=url_for_key(i.image_key, storage),
                unit_price=i.unit_price,
                quantity=i.quantity,
                line_total=i.line_total,
            )
            for i in order.items
        ],
        payment=PaymentOut(
            id=payment.id,
            provider=payment.provider,
            status=payment.status,
            amount=payment.amount,
            currency=payment.currency,
            provider_order_id=payment.provider_order_id,
            checkout=checkout,
        )
        if payment
        else None,
        placed_at=order.placed_at,
        paid_at=order.paid_at,
    )


def _with_key(out: OrderOut, settings) -> OrderOut:  # type: ignore[no-untyped-def]
    if out.payment and out.payment.checkout is not None:
        out.payment.checkout["key_id"] = settings.razorpay_key_id
    return out


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(PUBLIC_FORM_LIMIT)
async def place_order(
    request: Request,
    response: Response,
    data: OrderIn,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> OrderOut:
    cart = await CartService(db, settings).get_or_create(customer, session_token)
    service = OrderService(db, settings, build_payment_provider(settings))
    order = await service.place(
        customer,
        cart,
        data,
        session_token=session_token,
        user_agent=request.headers.get("user-agent"),
    )
    log.info(
        "order_placed",
        order=order.order_number,
        customer_id=str(customer.id),
        total=str(order.grand_total),
    )
    return _with_key(order_out(order, storage), settings)


@router.get("", response_model=list[OrderOut])
async def my_orders(
    customer: CurrentCustomerDep, db: DBDep, storage: StorageDep, settings: SettingsDep
) -> list[OrderOut]:
    service = OrderService(db, settings, build_payment_provider(settings))
    return [_with_key(order_out(o, storage), settings) for o in await service.list_mine(customer)]


@router.get("/{order_id}", response_model=OrderOut)
async def my_order(
    order_id: uuid.UUID,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> OrderOut:
    service = OrderService(db, settings, build_payment_provider(settings))
    return _with_key(order_out(await service.get_mine(customer, order_id), storage), settings)


@router.post("/{order_id}/confirm-payment", response_model=OrderOut)
async def confirm_payment(
    order_id: uuid.UUID,
    data: PaymentConfirmIn,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> OrderOut:
    service = OrderService(db, settings, build_payment_provider(settings))
    order = await service.confirm_online_payment(
        customer,
        order_id,
        provider_order_id=data.provider_order_id,
        provider_payment_id=data.provider_payment_id,
        signature=data.signature,
    )
    return order_out(order, storage)


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(
    order_id: uuid.UUID,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> OrderOut:
    service = OrderService(db, settings, build_payment_provider(settings))
    return order_out(await service.cancel_mine(customer, order_id), storage)


@router.post("/payments/webhook", response_model=Message, include_in_schema=False)
async def payment_webhook(
    request: Request,
    db: DBDep,
    settings: SettingsDep,
    x_razorpay_signature: str | None = Header(default=None),
) -> Message:
    """Razorpay webhook: marks payments captured/failed after verifying the HMAC signature."""
    provider = build_payment_provider(settings)
    body = await request.body()
    if not x_razorpay_signature or not provider.verify_webhook(
        body=body, signature=x_razorpay_signature
    ):
        raise AuthorizationError("Invalid webhook signature.")
    try:
        event = json.loads(body or b"{}")
    except json.JSONDecodeError:
        return Message(message="ignored")
    entity = (
        event.get("payload", {}).get("payment", {}).get("entity", {})
        if isinstance(event, dict)
        else {}
    )
    provider_order_id = entity.get("order_id")
    if not provider_order_id:
        return Message(message="ignored")
    payment = (
        await db.execute(select(Payment).where(Payment.provider_order_id == provider_order_id))
    ).scalar_one_or_none()
    if payment is None:
        return Message(message="ignored")
    order = await db.get(Order, payment.order_id)
    kind = event.get("event")
    amount_ok = (
        int(entity.get("amount", -1)) == int(payment.amount * 100)
        and str(entity.get("currency", "")) == payment.currency
    )
    if kind == "payment.captured" and order is not None:
        if payment.status == PaymentStatus.CAPTURED.value:
            return Message(message="duplicate")  # idempotent replay
        if not amount_ok or order.status != OrderStatus.AWAITING_PAYMENT.value:
            payment.raw_response = {**(payment.raw_response or {}), "disputed_webhook": entity}
            log.warning(
                "payment_capture_mismatch",
                order=order.order_number,
                status=order.status,
                amount_ok=amount_ok,
            )
            await db.flush()
            return Message(message="held")  # staff review in the admin dashboard
        payment.status = PaymentStatus.CAPTURED.value
        payment.provider_payment_id = entity.get("id")
        order.status = OrderStatus.PAID.value
        order.paid_at = datetime.now(UTC)
    elif kind == "payment.failed" and payment.status == PaymentStatus.CREATED.value:
        payment.status = PaymentStatus.FAILED.value
        payment.failure_reason = str(entity.get("error_description", ""))[:255]
    await db.flush()
    return Message(message="ok")
