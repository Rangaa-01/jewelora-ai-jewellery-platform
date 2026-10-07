from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.payments import RazorpayProvider
from tests.factories import make_product, make_store
from tests.helpers import logout, register_customer


async def test_guest_cart_then_merge_on_login(client: AsyncClient, db: AsyncSession) -> None:
    product = await make_product(db, with_variant=True, with_size=True, stock_quantity=2)
    sized = await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
    assert sized.status_code == 422 and sized.json()["error"]["code"] == "size_required"
    added = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": str(product.id),
            "variant_id": str(product.variants[0].id),
            "size_id": str(product.sizes[0].id),
            "quantity": 1,
        },
    )
    assert added.status_code == 201, added.text
    cart = added.json()
    assert cart["item_count"] == 1 and Decimal(cart["subtotal"]) == product.price
    assert Decimal(cart["tax_total"]) == (product.price * Decimal("0.03")).quantize(Decimal("0.01"))
    assert "jw_session" in client.cookies

    too_many = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": str(product.id),
            "variant_id": str(product.variants[0].id),
            "size_id": str(product.sizes[0].id),
            "quantity": 5,
        },
    )
    assert too_many.status_code == 409 and too_many.json()["error"]["code"] == "out_of_stock"

    # Sign up with the same session cookie: the guest cart becomes the customer's cart.
    await register_customer(client)
    mine = await client.get("/api/v1/cart")
    assert mine.json()["item_count"] == 1
    item_id = mine.json()["items"][0]["id"]
    updated = await client.patch(f"/api/v1/cart/items/{item_id}", json={"quantity": 2})
    assert updated.json()["item_count"] == 2
    removed = await client.delete(f"/api/v1/cart/items/{item_id}")
    assert removed.json()["item_count"] == 0


async def test_place_pickup_order_and_cancel(client: AsyncClient, db: AsyncSession) -> None:
    store = await make_store(db)
    product = await make_product(db, stock_quantity=1, with_image=True)
    await register_customer(client)
    await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
    invalid = await client.post(
        "/api/v1/orders",
        json={
            "fulfilment_method": "delivery",
            "contact_name": "Priya",
            "contact_phone": "9876543210",
        },
    )
    assert invalid.status_code == 422
    placed = await client.post(
        "/api/v1/orders",
        json={
            "fulfilment_method": "store_pickup",
            "store_id": str(store.id),
            "payment_method": "pay_at_store",
            "contact_name": "Priya",
            "contact_phone": "9876543210",
        },
    )
    assert placed.status_code == 201, placed.text
    order = placed.json()
    assert order["order_number"].startswith("JW") and order["status"] == "pending"
    assert order["items"][0]["name"] == product.name and order["items"][0]["image_url"]
    assert order["payment"]["provider"] == "none"
    assert Decimal(order["grand_total"]) == (product.price * Decimal("1.03")).quantize(
        Decimal("0.01")
    )
    assert (await client.get("/api/v1/cart")).json()["item_count"] == 0

    await db.refresh(product)
    assert product.stock_quantity == 0
    listed = await client.get("/api/v1/orders")
    assert [o["id"] for o in listed.json()] == [order["id"]]

    online = await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
    assert online.status_code == 409, "stock was reserved by the order"

    cancelled = await client.post(f"/api/v1/orders/{order['id']}/cancel")
    assert cancelled.json()["status"] == "cancelled"
    await db.refresh(product)
    assert product.stock_quantity == 1

    logout(client)
    await register_customer(client, email="other@example.com")
    assert (await client.get(f"/api/v1/orders/{order['id']}")).status_code == 404


async def test_online_payment_requires_configured_provider(
    client: AsyncClient, db: AsyncSession
) -> None:
    store = await make_store(db)
    product = await make_product(db)
    await register_customer(client)
    await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
    response = await client.post(
        "/api/v1/orders",
        json={
            "fulfilment_method": "store_pickup",
            "store_id": str(store.id),
            "payment_method": "razorpay",
            "contact_name": "Priya",
            "contact_phone": "9876543210",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "payment_method_unavailable"


@pytest.mark.asyncio
async def test_razorpay_provider_creates_orders_and_verifies_signatures() -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.headers["authorization"].startswith("Basic ")
        payload = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "order_ABC",
                "amount": payload["amount"],
                "currency": payload["currency"],
                "status": "created",
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = RazorpayProvider("rzp_test_key", "secret", "whsec", client=client)
    order = await provider.create_order(
        amount=Decimal("1234.50"),
        currency="INR",
        receipt="JW2610000001",
        notes={"order_number": "JW2610000001"},
    )
    assert order.provider_order_id == "order_ABC" and order.checkout == {
        "key_id": "rzp_test_key",
        "order_id": "order_ABC",
        "amount": 123450,
        "currency": "INR",
    }
    assert json.loads(calls[0].content)["amount"] == 123450

    good = hmac.new(b"secret", b"order_ABC|pay_1", hashlib.sha256).hexdigest()
    assert provider.verify_payment(
        provider_order_id="order_ABC", provider_payment_id="pay_1", signature=good
    )
    assert not provider.verify_payment(
        provider_order_id="order_ABC", provider_payment_id="pay_1", signature="bad"
    )
    body = b'{"event":"payment.captured"}'
    assert provider.verify_webhook(
        body=body, signature=hmac.new(b"whsec", body, hashlib.sha256).hexdigest()
    )

    def failing(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"description": "bad key"}})

    broken = RazorpayProvider(
        "k", "s", None, client=httpx.AsyncClient(transport=httpx.MockTransport(failing))
    )
    with pytest.raises(Exception) as exc:
        await broken.create_order(amount=Decimal("10"), currency="INR", receipt="r", notes={})
    assert getattr(exc.value, "code", "") == "payment_unavailable"


async def test_webhook_rejects_bad_signature(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/orders/payments/webhook", content=b"{}", headers={"X-Razorpay-Signature": "nope"}
    )
    assert response.status_code == 403
