from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Role
from tests.factories import make_product, make_staff, make_store
from tests.helpers import login, logout, register_customer


async def _seed_activity(client: AsyncClient, db: AsyncSession) -> dict[str, str]:
    store = await make_store(db)
    product = await make_product(db, name="Hot Necklace", with_image=True, stock_quantity=5)
    await register_customer(client)
    await client.get(f"/api/v1/products/{product.slug}")  # view event
    await client.post("/api/v1/wishlist/items", json={"product_id": str(product.id)})
    await client.post(
        "/api/v1/enquiries",
        json={
            "name": "Priya Raman",
            "phone": "9876543210",
            "product_id": str(product.id),
            "message": "Is this in stock right now?",
        },
    )
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    appt = await client.post(
        "/api/v1/appointments",
        json={
            "store_id": str(store.id),
            "starts_at": tomorrow.isoformat(),
            "guest_name": "Priya Raman",
            "guest_phone": "9876543210",
            "product_ids": [str(product.id)],
        },
    )
    await client.post("/api/v1/cart/items", json={"product_id": str(product.id)})
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
    look = await client.post(
        "/api/v1/looks", json={"title": "Look", "items": [{"product_id": str(product.id)}]}
    )
    logout(client)
    return {
        "product_id": str(product.id),
        "order_id": order.json()["id"],
        "appointment_id": appt.json()["id"],
        "look_id": look.json()["id"],
    }


async def test_sales_staff_can_work_queues_but_not_manage(
    client: AsyncClient, db: AsyncSession
) -> None:
    ids = await _seed_activity(client, db)
    email, password = await make_staff(db, Role.SALES_STAFF)
    await login(client, email, password)

    customers = await client.get("/api/v1/admin/customers", params={"q": "priya"})
    assert customers.status_code == 200 and customers.json()["total"] == 1
    row = customers.json()["items"][0]
    assert (
        row["orders_count"] == 1
        and row["enquiries_count"] == 1
        and row["appointments_count"] == 1
        and row["looks_count"] == 1
        and row["wishlist_count"] == 1
    )
    detail = await client.get(f"/api/v1/admin/customers/{row['id']}")
    assert detail.status_code == 200 and detail.json()["notes"] is None

    enquiries = await client.get("/api/v1/admin/enquiries", params={"status": "new"})
    assert enquiries.json()["total"] == 1
    updated = await client.patch(
        f"/api/v1/admin/enquiries/{enquiries.json()['items'][0]['id']}",
        json={"status": "resolved", "staff_notes": "Called back"},
    )
    assert updated.status_code == 200 and updated.json()["status"] == "resolved"

    appointments = await client.get("/api/v1/admin/appointments", params={"status": "requested"})
    assert appointments.json()["total"] == 1
    confirmed = await client.patch(
        f"/api/v1/admin/appointments/{ids['appointment_id']}", json={"status": "confirmed"}
    )
    assert confirmed.json()["status"] == "confirmed"

    orders = await client.get("/api/v1/admin/orders", params={"q": "priya"})
    assert orders.json()["total"] == 1
    paid = await client.patch(
        f"/api/v1/admin/orders/{ids['order_id']}",
        json={"mark_paid": True, "status": "ready_for_pickup"},
    )
    assert (
        paid.json()["status"] == "ready_for_pickup"
        and paid.json()["paid_at"]
        and paid.json()["payment"]["status"] == "captured"
    )

    looks = await client.get("/api/v1/admin/looks")
    assert looks.json()["total"] == 1

    # Sales staff cannot manage customers' accounts, staff or the catalogue.
    assert (
        await client.patch(f"/api/v1/admin/customers/{row['id']}", json={"notes": "x"})
    ).status_code == 403
    assert (
        await client.post(
            "/api/v1/admin/staff",
            json={
                "full_name": "New",
                "email": "n@x.com",
                "password": "Secure#2024",
                "roles": ["manager"],
            },
        )
    ).status_code == 403
    assert (await client.get("/api/v1/admin/products")).status_code == 403


async def test_admin_analytics_overview(client: AsyncClient, db: AsyncSession) -> None:
    ids = await _seed_activity(client, db)
    email, password = await make_staff(db, Role.ADMIN)
    await login(client, email, password)
    overview = await client.get("/api/v1/admin/analytics/overview", params={"days": 7})
    assert overview.status_code == 200, overview.text
    body = overview.json()
    assert (
        body["totals"]["customers"] == 1
        and body["totals"]["orders"] == 1
        and body["totals"]["enquiries"] == 1
    )
    assert (
        body["most_viewed"][0]["product_id"] == ids["product_id"]
        and body["most_viewed"][0]["count"] == 1
    )
    assert body["most_wishlisted"][0]["product_id"] == ids["product_id"]
    assert body["most_enquired"][0]["product_id"] == ids["product_id"]
    assert body["most_purchased"][0]["product_id"] == ids["product_id"]
    assert Decimal(body["revenue"]["pending"]) > 0 and body["orders_per_day"][0]["count"] == 1

    staff = await client.post(
        "/api/v1/admin/staff",
        json={
            "full_name": "New Manager",
            "email": "manager2@jewelora.test",
            "password": "Secure#2024",
            "roles": ["manager"],
        },
    )
    assert staff.status_code == 201 and staff.json()["roles"] == ["manager"]

    customers = await client.get("/api/v1/admin/customers")
    cid = customers.json()["items"][0]["id"]
    deactivated = await client.patch(
        f"/api/v1/admin/customers/{cid}", json={"is_active": False, "notes": "VIP"}
    )
    assert deactivated.json()["user"]["is_active"] is False and deactivated.json()["notes"] == "VIP"
    logout(client)
    blocked = await client.post(
        "/api/v1/auth/login", json={"identifier": "priya@example.com", "password": "Secure#2024"}
    )
    assert blocked.status_code == 401 and blocked.json()["error"]["code"] == "account_disabled"


async def test_customers_cannot_reach_admin(client: AsyncClient) -> None:
    await register_customer(client)
    assert (await client.get("/api/v1/admin/analytics/overview")).status_code == 403
    assert (await client.get("/api/v1/admin/customers")).status_code == 403
