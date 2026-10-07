"""Wishlists, saved looks, appointments and enquiries."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.settings import Settings
from app.integrations.notifications import Notifier
from app.models.catalogue import Product
from app.models.engagement import (
    Appointment,
    Enquiry,
    SavedLook,
    SavedLookItem,
    Wishlist,
    WishlistItem,
)
from app.models.enums import AnalyticsEventType, AppointmentStatus
from app.models.tryon import TryOnResult, TryOnSession
from app.models.user import Customer, Store
from app.schemas.engagement import (
    AppointmentIn,
    EnquiryIn,
    SavedLookIn,
    SavedLookUpdate,
    WishlistItemIn,
)
from app.services.analytics_service import record_event
from app.services.catalogue_service import PRODUCT_LOAD_OPTIONS, CatalogueService
from app.services.references import reference, share_token
from app.storage import ObjectStorage
from app.storage.base import look_preview_key

APPOINTMENT_OPEN_HOUR = 10
APPOINTMENT_CLOSE_HOUR = 20


class WishlistService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_or_create(self, customer: Customer) -> Wishlist:
        stmt = (
            select(Wishlist)
            .options(
                selectinload(Wishlist.items)
                .selectinload(WishlistItem.product)
                .options(*PRODUCT_LOAD_OPTIONS)
            )
            .where(Wishlist.customer_id == customer.id, Wishlist.is_default.is_(True))
        )
        wishlist = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if wishlist is None:
            wishlist = Wishlist(customer_id=customer.id, items=[])
            self.db.add(wishlist)
            await self.db.flush()
        return wishlist

    async def add_item(
        self, customer: Customer, data: WishlistItemIn, *, session_token: str | None = None
    ) -> WishlistItem:
        if not data.product_id and not data.saved_look_id:
            raise ValidationAppError("Choose a product or a look to save.", code="nothing_to_save")
        wishlist = await self.get_or_create(customer)
        for existing in wishlist.items:
            if (
                existing.product_id == data.product_id
                and existing.variant_id == data.variant_id
                and existing.saved_look_id == data.saved_look_id
            ):
                return existing
        if data.product_id:
            product = await CatalogueService(self.db).get_product(
                data.product_id, include_inactive=False
            )
            if data.variant_id and not any(v.id == data.variant_id for v in product.variants):
                raise ValidationAppError(
                    "That variation isn't available for this piece.", code="variant_not_found"
                )
            product.wishlist_count += 1
            await record_event(
                self.db,
                AnalyticsEventType.PRODUCT_WISHLIST,
                product_id=product.id,
                customer_id=customer.id,
                session_token=session_token,
            )
        if data.saved_look_id:
            look = await self.db.get(SavedLook, data.saved_look_id)
            if look is None or look.customer_id != customer.id:
                raise NotFoundError(code="look_not_found")
        item = WishlistItem(
            wishlist_id=wishlist.id,
            product_id=data.product_id,
            variant_id=data.variant_id,
            saved_look_id=data.saved_look_id,
            note=data.note,
            created_at=datetime.now(UTC),
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item, attribute_names=["product"])
        return item

    async def remove_item(self, customer: Customer, item_id: uuid.UUID) -> None:
        wishlist = await self.get_or_create(customer)
        item = next((i for i in wishlist.items if i.id == item_id), None)
        if item is None:
            raise NotFoundError(code="item_not_found")
        if item.product_id:
            product = await self.db.get(Product, item.product_id)
            if product and product.wishlist_count > 0:
                product.wishlist_count -= 1
        await self.db.delete(item)
        await self.db.flush()

    async def ensure_share_token(self, customer: Customer) -> Wishlist:
        wishlist = await self.get_or_create(customer)
        if not wishlist.share_token:
            wishlist.share_token = share_token()
            await self.db.flush()
        return wishlist

    async def by_share_token(self, token: str) -> Wishlist:
        stmt = (
            select(Wishlist)
            .options(
                selectinload(Wishlist.items)
                .selectinload(WishlistItem.product)
                .options(*PRODUCT_LOAD_OPTIONS)
            )
            .where(Wishlist.share_token == token)
        )
        wishlist = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if wishlist is None:
            raise NotFoundError(
                "This shared list is no longer available.", code="wishlist_not_found"
            )
        return wishlist


LOOK_OPTIONS = (
    selectinload(SavedLook.items)
    .selectinload(SavedLookItem.product)
    .options(*PRODUCT_LOAD_OPTIONS),
)


class LookService:
    def __init__(self, db: AsyncSession, storage: ObjectStorage | None = None) -> None:
        self.db = db
        self.storage = storage

    async def _publish_preview(self, look: SavedLook) -> None:
        """Copy the private try-on image to a public key when a look is made public."""
        if look.public_preview_key or not look.preview_storage_key or self.storage is None:
            return
        data = await self.storage.get(look.preview_storage_key)
        key = look_preview_key(str(look.customer_id), "webp")
        await self.storage.put(key, data, "image/webp")
        look.public_preview_key = key

    async def _unpublish_preview(self, look: SavedLook) -> None:
        if look.public_preview_key and self.storage is not None:
            await self.storage.delete(look.public_preview_key)
        look.public_preview_key = None

    async def list_mine(self, customer: Customer) -> list[SavedLook]:
        stmt = (
            select(SavedLook)
            .options(*LOOK_OPTIONS)
            .where(SavedLook.customer_id == customer.id)
            .order_by(SavedLook.created_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().unique().all())

    async def get_mine(self, customer: Customer, look_id: uuid.UUID) -> SavedLook:
        stmt = (
            select(SavedLook)
            .options(*LOOK_OPTIONS)
            .where(SavedLook.id == look_id, SavedLook.customer_id == customer.id)
        )
        look = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if look is None:
            raise NotFoundError(code="look_not_found")
        return look

    async def create(
        self, customer: Customer, data: SavedLookIn, *, session_token: str | None = None
    ) -> SavedLook:
        products = {
            p.id: p
            for p in await CatalogueService(self.db).get_products_by_ids(
                [i.product_id for i in data.items]
            )
        }
        missing = [str(i.product_id) for i in data.items if i.product_id not in products]
        if missing:
            raise ValidationAppError(
                "Some pieces in this look are no longer available.", code="product_not_found"
            )
        preview_key = None
        photo_id = None
        if data.tryon_result_id:
            result = await self.db.get(TryOnResult, data.tryon_result_id)
            session = await self.db.get(TryOnSession, result.session_id) if result else None
            if result is None or session is None or session.customer_id != customer.id:
                raise NotFoundError(code="result_not_found")
            preview_key = result.result_storage_key
            photo_id = result.photo_id
        look = SavedLook(
            customer_id=customer.id,
            title=data.title,
            kind=data.kind,
            tryon_result_id=data.tryon_result_id,
            photo_id=photo_id,
            preview_storage_key=preview_key,
            notes=data.notes,
            is_public=data.is_public,
            share_token=share_token() if data.is_public else None,
            items=[],
        )
        self.db.add(look)
        await self.db.flush()
        for index, item in enumerate(data.items):
            look.items.append(
                SavedLookItem(
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    size_id=item.size_id,
                    slot=item.slot,
                    adjustments=item.adjustments.model_dump() if item.adjustments else None,
                    sort_order=index,
                )
            )
        await self.db.flush()
        await record_event(
            self.db,
            AnalyticsEventType.LOOK_CREATED,
            customer_id=customer.id,
            saved_look_id=look.id,
            session_token=session_token,
            properties={"kind": data.kind, "items": len(data.items)},
        )
        for item in data.items:
            await record_event(
                self.db,
                AnalyticsEventType.LOOK_CREATED,
                product_id=item.product_id,
                customer_id=customer.id,
                saved_look_id=look.id,
                properties={"role": "item"},
            )
        if look.is_public:
            await self._publish_preview(look)
        await self.db.flush()
        stmt = select(SavedLook).options(*LOOK_OPTIONS).where(SavedLook.id == look.id)
        return (
            (await self.db.execute(stmt.execution_options(populate_existing=True)))
            .scalars()
            .unique()
            .one()
        )

    async def update(
        self, customer: Customer, look_id: uuid.UUID, data: SavedLookUpdate
    ) -> SavedLook:
        look = await self.get_mine(customer, look_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(look, key, value)
        if look.is_public:
            if not look.share_token:
                look.share_token = share_token()
            await self._publish_preview(look)
        else:
            await self._unpublish_preview(look)
        await self.db.flush()
        return look

    async def share(
        self, customer: Customer, look_id: uuid.UUID, *, channel: str | None = None
    ) -> SavedLook:
        look = await self.get_mine(customer, look_id)
        if not look.share_token:
            look.share_token = share_token()
        # Link sharing only: the look becomes reachable by token, never listed publicly.
        look.shared_at = look.shared_at or datetime.now(UTC)
        look.share_count += 1
        await record_event(
            self.db,
            AnalyticsEventType.LOOK_SHARED,
            customer_id=customer.id,
            saved_look_id=look.id,
            properties={"channel": channel or "link"},
        )
        for item in look.items:
            await record_event(
                self.db,
                AnalyticsEventType.PRODUCT_SHARE,
                product_id=item.product_id,
                customer_id=customer.id,
                saved_look_id=look.id,
            )
        await self.db.flush()
        return look

    async def delete(self, customer: Customer, look_id: uuid.UUID) -> None:
        look = await self.get_mine(customer, look_id)
        await self.db.delete(look)
        await self.db.flush()

    async def by_token(self, token: str) -> SavedLook:
        stmt = (
            select(SavedLook)
            .options(*LOOK_OPTIONS)
            .where(
                SavedLook.share_token == token,
                (SavedLook.is_public.is_(True)) | (SavedLook.shared_at.is_not(None)),
            )
        )
        look = (await self.db.execute(stmt)).scalars().unique().one_or_none()
        if look is None:
            raise NotFoundError("This look is no longer shared.", code="look_not_found")
        return look

    async def public_feed(self, limit: int) -> list[SavedLook]:
        stmt = (
            select(SavedLook)
            .options(*LOOK_OPTIONS)
            .where(SavedLook.is_public.is_(True), SavedLook.public_preview_key.is_not(None))
            .order_by(SavedLook.share_count.desc(), SavedLook.created_at.desc())
            .limit(limit)
        )
        return list((await self.db.execute(stmt)).scalars().unique().all())


def look_total(look: SavedLook) -> Decimal:
    total = Decimal("0")
    for item in look.items:
        price = item.product.price
        variant = next((v for v in item.product.variants if v.id == item.variant_id), None)
        if variant:
            price += variant.price_delta
        size = next((s for s in item.product.sizes if s.id == item.size_id), None)
        if size:
            price += size.price_delta
        total += price
    return total


async def _resolve_look_reference(
    db: AsyncSession,
    saved_look_id: uuid.UUID | None,
    look_token: str | None,
    customer: Customer | None,
) -> uuid.UUID | None:
    """A look may be referenced by its owner (id) or by anyone holding a share token."""
    if look_token:
        return (await LookService(db).by_token(look_token)).id
    if saved_look_id is None:
        return None
    look = await db.get(SavedLook, saved_look_id)
    if look is None or (
        (customer is None or look.customer_id != customer.id)
        and not look.is_public
        and not look.shared_at
    ):
        raise NotFoundError(code="look_not_found")
    return look.id


class AppointmentService:
    def __init__(self, db: AsyncSession, settings: Settings, notifier: Notifier) -> None:
        self.db = db
        self.settings = settings
        self.notifier = notifier

    async def _store(self, store_id: uuid.UUID) -> Store:
        store = await self.db.get(Store, store_id)
        if store is None or not store.is_active:
            raise NotFoundError(
                "That store isn't available for appointments.", code="store_not_found"
            )
        return store

    async def slots(
        self, store_id: uuid.UUID, day: datetime
    ) -> list[tuple[datetime, datetime, bool]]:
        store = await self._store(store_id)
        step = timedelta(minutes=store.appointment_slot_minutes)
        day_start = day.replace(hour=APPOINTMENT_OPEN_HOUR, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=APPOINTMENT_CLOSE_HOUR, minute=0, second=0, microsecond=0)
        booked = (
            await self.db.execute(
                select(Appointment.starts_at, Appointment.ends_at).where(
                    Appointment.store_id == store.id,
                    Appointment.starts_at >= day_start,
                    Appointment.starts_at < day_end,
                    Appointment.status.in_(
                        [AppointmentStatus.REQUESTED.value, AppointmentStatus.CONFIRMED.value]
                    ),
                )
            )
        ).all()
        now = datetime.now(UTC)
        out = []
        cursor = day_start
        while cursor + step <= day_end:
            end = cursor + step
            taken = sum(1 for s, e in booked if s < end and e > cursor)
            out.append(
                (cursor, end, taken < 3 and cursor > now)
            )  # three concurrent consultations per store
            cursor = end
        return out

    async def book(
        self,
        data: AppointmentIn,
        *,
        customer: Customer | None,
        session_token: str | None,
        user_agent: str | None,
    ) -> Appointment:
        store = await self._store(data.store_id)
        starts = data.starts_at if data.starts_at.tzinfo else data.starts_at.replace(tzinfo=UTC)
        if starts < datetime.now(UTC) + timedelta(minutes=30):
            raise ValidationAppError(
                "Please choose a time at least 30 minutes from now.", code="too_soon"
            )
        if starts > datetime.now(UTC) + timedelta(days=90):
            raise ValidationAppError(
                "Appointments can be booked up to 90 days ahead.", code="too_far"
            )
        ends = starts + timedelta(minutes=store.appointment_slot_minutes)
        overlapping = (
            await self.db.execute(
                select(func.count())
                .select_from(Appointment)
                .where(
                    Appointment.store_id == store.id,
                    Appointment.starts_at < ends,
                    Appointment.ends_at > starts,
                    Appointment.status.in_(
                        [AppointmentStatus.REQUESTED.value, AppointmentStatus.CONFIRMED.value]
                    ),
                )
            )
        ).scalar_one()
        if overlapping >= 3:
            raise ConflictError(
                "That time is fully booked. Please pick another slot.", code="slot_full"
            )
        catalogue = CatalogueService(self.db)
        product_ids = list(data.product_ids)
        for slug in data.product_slugs:
            product_ids.append((await catalogue.get_product_by_slug(slug)).id)
        saved_look_id = await _resolve_look_reference(
            self.db, data.saved_look_id, data.look_token, customer
        )
        appointment = Appointment(
            customer_id=customer.id if customer else None,
            store_id=store.id,
            reference=reference("AP"),
            guest_name=data.guest_name,
            guest_phone=data.guest_phone,
            guest_email=str(data.guest_email).lower() if data.guest_email else None,
            starts_at=starts,
            ends_at=ends,
            party_size=data.party_size,
            purpose=data.purpose,
            notes=data.notes,
            product_ids=[str(p) for p in product_ids],
            saved_look_id=saved_look_id,
        )
        self.db.add(appointment)
        await self.db.flush()
        await record_event(
            self.db,
            AnalyticsEventType.APPOINTMENT_BOOKED,
            customer_id=customer.id if customer else None,
            session_token=session_token,
            saved_look_id=saved_look_id,
            properties={"store": store.slug, "party_size": data.party_size},
            user_agent=user_agent,
        )
        await self.notifier.send(
            to=store.email or self.settings.notification_email_from,
            subject=f"New appointment {appointment.reference} at {store.name}",
            body=(
                f"{data.guest_name} requested {starts:%d %b %Y %H:%M} for {data.party_size}. "
                f"Purpose: {data.purpose or '-'}. Open the admin dashboard for contact details."
            ),
        )
        return appointment

    async def list_mine(self, customer: Customer) -> list[Appointment]:
        stmt = (
            select(Appointment)
            .where(Appointment.customer_id == customer.id)
            .order_by(Appointment.starts_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def cancel_mine(self, customer: Customer, appointment_id: uuid.UUID) -> Appointment:
        appointment = await self.db.get(Appointment, appointment_id)
        if appointment is None or appointment.customer_id != customer.id:
            raise NotFoundError(code="appointment_not_found")
        if appointment.status in {
            AppointmentStatus.COMPLETED.value,
            AppointmentStatus.CANCELLED.value,
        }:
            raise ConflictError(
                "This appointment can no longer be cancelled.", code="not_cancellable"
            )
        appointment.status = AppointmentStatus.CANCELLED.value
        await self.db.flush()
        return appointment


class EnquiryService:
    def __init__(self, db: AsyncSession, settings: Settings, notifier: Notifier) -> None:
        self.db = db
        self.settings = settings
        self.notifier = notifier

    async def create(
        self,
        data: EnquiryIn,
        *,
        customer: Customer | None,
        session_token: str | None,
        user_agent: str | None,
    ) -> Enquiry:
        product = None
        if data.product_id:
            product = await CatalogueService(self.db).get_product(
                data.product_id, include_inactive=False
            )
        elif data.product_slug:
            product = await CatalogueService(self.db).get_product_by_slug(data.product_slug)
        saved_look_id = await _resolve_look_reference(
            self.db, data.saved_look_id, data.look_token, customer
        )
        enquiry = Enquiry(
            customer_id=customer.id if customer else None,
            product_id=product.id if product else None,
            saved_look_id=saved_look_id,
            reference=reference("EN"),
            name=data.name,
            phone=data.phone,
            email=str(data.email).lower() if data.email else None,
            message=data.message,
            preferred_contact=data.preferred_contact.value,
        )
        self.db.add(enquiry)
        await self.db.flush()
        await record_event(
            self.db,
            AnalyticsEventType.PRODUCT_ENQUIRY,
            product_id=product.id if product else None,
            customer_id=customer.id if customer else None,
            session_token=session_token,
            saved_look_id=saved_look_id,
            user_agent=user_agent,
        )
        await self.notifier.send(
            to=self.settings.notification_email_from,
            subject=f"New enquiry {enquiry.reference}"
            + (f" about {product.name}" if product else ""),
            body=(
                f"{data.name} sent an enquiry (prefers {data.preferred_contact.value}). "
                "Open the admin dashboard to read it and reply."
            ),
        )
        await self.db.refresh(enquiry, attribute_names=["product"])
        return enquiry

    async def list_mine(self, customer: Customer) -> list[Enquiry]:
        stmt = (
            select(Enquiry)
            .where(Enquiry.customer_id == customer.id)
            .order_by(Enquiry.created_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())
