"""Regression tests for the security review findings."""

from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.models.commerce import Order, Payment
from app.models.enums import OrderStatus, PaymentStatus, Role
from app.services.catalogue_service import escape_like
from app.services.tryon_service import Owner
from tests.factories import make_product, make_staff, make_store
from tests.helpers import login, logout, register_customer


async def test_share_link_does_not_publish_to_the_public_feed(
    client: AsyncClient, db: AsyncSession
) -> None:
    product = await make_product(db, with_image=True)
    await register_customer(client)
    look = (
        await client.post(
            "/api/v1/looks", json={"title": "Private", "items": [{"product_id": str(product.id)}]}
        )
    ).json()
    shared = await client.post(f"/api/v1/looks/{look['id']}/share")
    assert shared.status_code == 200 and shared.json()["is_public"] is False
    token = shared.json()["share_token"]
    logout(client)
    assert (await client.get(f"/api/v1/looks/shared/{token}")).status_code == 200, (
        "link holders can view"
    )
    feed = await client.get("/api/v1/looks/public")
    assert all(item["token"] != token for item in feed.json()), "never listed publicly"


async def test_guest_session_secret_is_not_embedded_in_storage_paths() -> None:
    owner = Owner(customer_id=None, session_token="super-secret-session-token-value")
    assert "super-secret" not in owner.key
    assert owner.key.startswith("anon-") and len(owner.key) == len("anon-") + 32


async def test_logout_clears_guest_session_cookie(client: AsyncClient, db: AsyncSession) -> None:
    product = await make_product(db)
    await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
    assert "jw_session" in client.cookies
    await register_customer(client)
    response = await client.post("/api/v1/auth/logout")
    cleared = [c for c in response.headers.get_list("set-cookie") if c.startswith("jw_session=")]
    assert cleared and ("Max-Age=0" in cleared[0] or "expires" in cleared[0].lower())


async def test_csrf_header_required_for_guest_sessions(
    client: AsyncClient, db: AsyncSession
) -> None:
    product = await make_product(db)
    await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
    blocked = await client.post(
        "/api/v1/cart/items", json={"product_id": str(product.id)}, headers={"X-Requested-With": ""}
    )
    assert blocked.status_code == 403 and blocked.json()["error"]["code"] == "csrf_rejected"


async def test_cancelling_restores_exactly_what_was_reserved(
    client: AsyncClient, db: AsyncSession
) -> None:
    store = await make_store(db)
    product = await make_product(db, stock_quantity=0, with_variant=True)
    product.variants[0].stock_quantity = 5
    await db.flush()
    await register_customer(client)
    added = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": str(product.id),
            "variant_id": str(product.variants[0].id),
            "quantity": 2,
        },
    )
    assert added.status_code == 201, added.text
    order = await client.post(
        "/api/v1/orders",
        json={
            "fulfilment_method": "store_pickup",
            "store_id": str(store.id),
            "payment_method": "pay_at_store",
            "contact_name": "Priya",
            "contact_phone": "9876543210",
        },
    )
    assert order.status_code == 201, order.text
    await db.refresh(product)
    await db.refresh(product.variants[0])
    assert product.stock_quantity == 0 and product.variants[0].stock_quantity == 3
    cancelled = await client.post(f"/api/v1/orders/{order.json()['id']}/cancel")
    assert cancelled.status_code == 200
    await db.refresh(product)
    await db.refresh(product.variants[0])
    assert product.stock_quantity == 0, "product stock must not be inflated by cancelling"
    assert product.variants[0].stock_quantity == 5


async def test_webhook_rejects_mismatched_amount_and_non_payable_orders(
    client: AsyncClient, db: AsyncSession
) -> None:
    store = await make_store(db)
    product = await make_product(db, price=Decimal("1000"))
    await register_customer(client)
    await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
    placed = (
        await client.post(
            "/api/v1/orders",
            json={
                "fulfilment_method": "store_pickup",
                "store_id": str(store.id),
                "payment_method": "pay_at_store",
                "contact_name": "Priya",
                "contact_phone": "9876543210",
            },
        )
    ).json()
    order = await db.get(Order, placed["id"])
    assert order is not None
    order.status = OrderStatus.AWAITING_PAYMENT.value
    payment = (
        await db.execute(
            __import__("sqlalchemy").select(Payment).where(Payment.order_id == order.id)
        )
    ).scalar_one()
    payment.provider = "razorpay"
    payment.provider_order_id = "order_TEST"
    await db.flush()

    # Provider configured for this test via settings override + webhook secret.
    from app.integrations import payments as payments_module

    settings = get_settings()
    secret = "whsec_test"

    def provider(_: object) -> payments_module.RazorpayProvider:
        return payments_module.RazorpayProvider("k", "s", secret)

    original = payments_module.build_payment_provider
    import app.api.v1.orders as orders_module

    orders_module.build_payment_provider = provider  # type: ignore[assignment]
    try:

        def signed(body: dict) -> dict:  # type: ignore[type-arg]
            raw = json.dumps(body).encode()
            return {
                "content": raw,
                "headers": {
                    "X-Razorpay-Signature": hmac.new(
                        secret.encode(), raw, hashlib.sha256
                    ).hexdigest(),
                    "X-Requested-With": "jewelora",
                },
            }

        wrong_amount = await client.post(
            "/api/v1/orders/payments/webhook",
            **signed(
                {
                    "event": "payment.captured",
                    "payload": {
                        "payment": {
                            "entity": {
                                "id": "pay_1",
                                "order_id": "order_TEST",
                                "amount": 1,
                                "currency": "INR",
                            }
                        }
                    },
                }
            ),
        )
        assert wrong_amount.json()["message"] == "held"
        await db.refresh(order)
        assert order.status == OrderStatus.AWAITING_PAYMENT.value

        amount = int(order.grand_total * 100)
        ok = await client.post(
            "/api/v1/orders/payments/webhook",
            **signed(
                {
                    "event": "payment.captured",
                    "payload": {
                        "payment": {
                            "entity": {
                                "id": "pay_1",
                                "order_id": "order_TEST",
                                "amount": amount,
                                "currency": "INR",
                            }
                        }
                    },
                }
            ),
        )
        assert ok.json()["message"] == "ok"
        await db.refresh(order)
        await db.refresh(payment)
        assert (
            order.status == OrderStatus.PAID.value
            and payment.status == PaymentStatus.CAPTURED.value
        )

        replay = await client.post(
            "/api/v1/orders/payments/webhook",
            **signed(
                {
                    "event": "payment.captured",
                    "payload": {
                        "payment": {
                            "entity": {
                                "id": "pay_1",
                                "order_id": "order_TEST",
                                "amount": amount,
                                "currency": "INR",
                            }
                        }
                    },
                }
            ),
        )
        assert replay.json()["message"] == "duplicate"
        failed_late = await client.post(
            "/api/v1/orders/payments/webhook",
            **signed(
                {
                    "event": "payment.failed",
                    "payload": {"payment": {"entity": {"id": "pay_1", "order_id": "order_TEST"}}},
                }
            ),
        )
        assert failed_late.json()["message"] == "ok"
        await db.refresh(payment)
        assert payment.status == PaymentStatus.CAPTURED.value, (
            "a late failure must not undo a capture"
        )
    finally:
        orders_module.build_payment_provider = original  # type: ignore[assignment]
    assert settings.payment_provider == "none"


async def test_sales_staff_cannot_mark_orders_paid_or_browse_private_looks(
    client: AsyncClient, db: AsyncSession
) -> None:
    email, password = await make_staff(db, Role.SALES_STAFF)
    await login(client, email, password)
    assert (await client.get("/api/v1/admin/looks")).status_code == 403
    assert (
        await client.patch(
            "/api/v1/admin/orders/00000000-0000-0000-0000-000000000000", json={"mark_paid": True}
        )
    ).status_code == 403


async def test_invalid_references_return_404_not_500(client: AsyncClient, db: AsyncSession) -> None:
    await register_customer(client)
    missing_store = await client.patch(
        "/api/v1/customers/me", json={"preferred_store_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert missing_store.status_code == 404
    enquiry = await client.post(
        "/api/v1/enquiries",
        json={
            "name": "Priya Raman",
            "phone": "9876543210",
            "message": "about a look please",
            "saved_look_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert enquiry.status_code == 404


def test_like_wildcards_are_escaped() -> None:
    assert escape_like("100% gold_ring") == "100\\% gold\\_ring"
