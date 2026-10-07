from __future__ import annotations

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import make_product, make_store
from tests.helpers import logout, register_customer


async def test_wishlist_requires_login_and_round_trips(
    client: AsyncClient, db: AsyncSession
) -> None:
    product = await make_product(db, with_variant=True, with_image=True)
    assert (await client.get("/api/v1/wishlist")).status_code == 401
    await register_customer(client)
    added = await client.post(
        "/api/v1/wishlist/items",
        json={"product_id": str(product.id), "variant_id": str(product.variants[0].id)},
    )
    assert added.status_code == 201, added.text
    again = await client.post(
        "/api/v1/wishlist/items",
        json={"product_id": str(product.id), "variant_id": str(product.variants[0].id)},
    )
    assert again.status_code == 201 and again.json()["id"] == added.json()["id"], "idempotent"
    bad_variant = await client.post(
        "/api/v1/wishlist/items",
        json={"product_id": str(product.id), "variant_id": str(product.id)},
    )
    assert bad_variant.status_code == 422

    mine = await client.get("/api/v1/wishlist")
    assert mine.json()["items"][0]["product"]["name"] == product.name
    detail = await client.get(f"/api/v1/products/{product.slug}")
    assert detail.status_code == 200

    shared = await client.post("/api/v1/wishlist/share")
    token = shared.json()["share_token"]
    assert shared.json()["share_url"].endswith(token)
    logout(client)
    public = await client.get(f"/api/v1/wishlist/shared/{token}")
    assert public.status_code == 200 and public.json()["share_token"] is None
    assert (await client.get("/api/v1/wishlist/shared/nope")).status_code == 404


async def test_saved_looks_share_and_public_feed(client: AsyncClient, db: AsyncSession) -> None:
    necklace = await make_product(db, name="Necklace", with_image=True)
    earrings = await make_product(db, name="Earrings", jewellery_type="earrings", with_image=True)
    await register_customer(client)
    created = await client.post(
        "/api/v1/looks",
        json={
            "title": "Reception look",
            "items": [
                {"product_id": str(necklace.id), "slot": "necklace"},
                {"product_id": str(earrings.id), "slot": "earrings"},
            ],
        },
    )
    assert created.status_code == 201, created.text
    look = created.json()
    assert look["total_price"] == str(necklace.price + earrings.price)
    assert look["share_token"] is None and look["is_public"] is False

    shared = await client.post(f"/api/v1/looks/{look['id']}/share?channel=whatsapp")
    assert shared.status_code == 200
    token = shared.json()["share_token"]
    assert shared.json()["share_count"] == 1 and shared.json()["is_public"] is True

    logout(client)
    public = await client.get(f"/api/v1/looks/shared/{token}")
    assert public.status_code == 200
    body = public.json()
    assert body["title"] == "Reception look" and "customer" not in body and len(body["items"]) == 2
    assert (
        await client.get("/api/v1/looks/public")
    ).status_code == 200  # no preview → excluded from feed, but endpoint works
    assert (await client.get(f"/api/v1/looks/{look['id']}")).status_code == 401

    await register_customer(client, email="other@example.com")
    assert (await client.get(f"/api/v1/looks/{look['id']}")).status_code == 404, (
        "other customers cannot read it"
    )
    missing = await client.post(
        "/api/v1/looks",
        json={"title": "x", "items": [{"product_id": "00000000-0000-0000-0000-000000000000"}]},
    )
    assert missing.status_code == 422


async def test_appointment_booking_slots_and_cancel(client: AsyncClient, db: AsyncSession) -> None:
    store = await make_store(db)
    product = await make_product(db)
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).replace(
        hour=11, minute=0, second=0, microsecond=0
    )
    slots = await client.get(
        "/api/v1/appointments/slots",
        params={"store_id": str(store.id), "day": tomorrow.date().isoformat()},
    )
    assert (
        slots.status_code == 200
        and len(slots.json()) == 20
        and slots.json()[0]["available"] is True
    )

    guest = await client.post(
        "/api/v1/appointments",
        json={
            "store_id": str(store.id),
            "starts_at": tomorrow.isoformat(),
            "guest_name": "Meera",
            "guest_phone": "9876543210",
            "party_size": 2,
            "purpose": "bridal",
            "product_slugs": [product.slug],
        },
    )
    assert guest.status_code == 201, guest.text
    body = guest.json()
    assert body["reference"].startswith("AP") and body["store"]["name"] == store.name
    assert body["products"][0]["slug"] == product.slug and body["guest_phone"] == "+919876543210"

    too_soon = await client.post(
        "/api/v1/appointments",
        json={
            "store_id": str(store.id),
            "starts_at": datetime.now(UTC).isoformat(),
            "guest_name": "Meera",
            "guest_phone": "9876543210",
        },
    )
    assert too_soon.status_code == 422 and too_soon.json()["error"]["code"] == "too_soon"

    # Fourth concurrent booking in the same slot is refused.
    for _ in range(2):
        ok = await client.post(
            "/api/v1/appointments",
            json={
                "store_id": str(store.id),
                "starts_at": tomorrow.isoformat(),
                "guest_name": "A B",
                "guest_phone": "9876543211",
            },
        )
        assert ok.status_code == 201
    full = await client.post(
        "/api/v1/appointments",
        json={
            "store_id": str(store.id),
            "starts_at": tomorrow.isoformat(),
            "guest_name": "A B",
            "guest_phone": "9876543212",
        },
    )
    assert full.status_code == 409

    await register_customer(client)
    mine = await client.post(
        "/api/v1/appointments",
        json={
            "store_id": str(store.id),
            "starts_at": (tomorrow + timedelta(hours=2)).isoformat(),
            "guest_name": "Priya",
            "guest_phone": "9876543213",
        },
    )
    assert mine.status_code == 201
    listed = await client.get("/api/v1/appointments")
    assert [a["id"] for a in listed.json()] == [mine.json()["id"]]
    cancelled = await client.post(f"/api/v1/appointments/{mine.json()['id']}/cancel")
    assert cancelled.json()["status"] == "cancelled"


async def test_enquiry_submission(client: AsyncClient, db: AsyncSession) -> None:
    product = await make_product(db)
    response = await client.post(
        "/api/v1/enquiries",
        json={
            "name": "Karthik",
            "phone": "+919000000000",
            "email": "k@example.com",
            "product_slug": product.slug,
            "message": "Is this available in 18K?",
            "preferred_contact": "whatsapp",
        },
    )
    assert response.status_code == 201, response.text
    assert (
        response.json()["reference"].startswith("EN")
        and response.json()["product"]["slug"] == product.slug
    )
    short = await client.post(
        "/api/v1/enquiries", json={"name": "K", "phone": "123", "message": "hi"}
    )
    assert short.status_code == 422
    fields = {d["field"] for d in short.json()["error"]["details"]}
    assert {"name", "phone", "message"} <= fields
