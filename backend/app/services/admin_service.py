"""Admin queries: customers, orders, enquiries, appointments, looks and analytics."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError
from app.models.analytics import AnalyticsEvent
from app.models.catalogue import Product
from app.models.commerce import Order
from app.models.engagement import (
    Appointment,
    Enquiry,
    SavedLook,
    StylistRequest,
    Wishlist,
    WishlistItem,
)
from app.models.enums import AnalyticsEventType, OrderStatus, PaymentStatus
from app.models.user import Customer, User
from app.services.catalogue_service import escape_like
from app.services.commerce_service import ORDER_OPTIONS
from app.services.engagement_service import LOOK_OPTIONS


@dataclass
class Overview:
    range_days: int
    totals: dict[str, int]
    revenue: dict[str, Decimal]
    most_tried: list[tuple[Product, int]]
    most_viewed: list[tuple[Product, int]]
    most_wishlisted: list[tuple[Product, int]]
    most_shared: list[tuple[Product, int]]
    most_enquired: list[tuple[Product, int]]
    most_purchased: list[tuple[Product, int]]
    tryons_per_day: list[tuple[str, int]]
    orders_per_day: list[tuple[str, int]]
    stylist_queries: int
    visual_searches: int


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # --- customers -------------------------------------------------------------------------

    async def _counts(self, customer_ids: list[uuid.UUID]) -> dict[str, dict[uuid.UUID, int]]:
        out: dict[str, dict[uuid.UUID, int]] = {}
        for name, model in (
            ("orders", Order),
            ("appointments", Appointment),
            ("enquiries", Enquiry),
            ("looks", SavedLook),
        ):
            rows = (
                await self.db.execute(
                    select(model.customer_id, func.count())
                    .where(model.customer_id.in_(customer_ids))
                    .group_by(model.customer_id)
                )
            ).all()
            out[name] = {cid: int(n) for cid, n in rows if cid is not None}
        rows = (
            await self.db.execute(
                select(Wishlist.customer_id, func.count(WishlistItem.id))
                .join(WishlistItem, WishlistItem.wishlist_id == Wishlist.id)
                .where(Wishlist.customer_id.in_(customer_ids))
                .group_by(Wishlist.customer_id)
            )
        ).all()
        out["wishlist"] = {cid: int(n) for cid, n in rows}
        return out

    async def list_customers(
        self, *, q: str | None, page: int, page_size: int
    ) -> tuple[list[tuple[Customer, dict[str, int]]], int]:
        stmt = (
            select(Customer)
            .join(User, User.id == Customer.user_id)
            .options(selectinload(Customer.user))
        )
        if q:
            term = f"%{escape_like(q.strip())}%"
            stmt = stmt.where(
                (User.full_name.ilike(term)) | (User.email.ilike(term)) | (User.phone.ilike(term))
            )
        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        stmt = (
            stmt.order_by(Customer.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        customers = list((await self.db.execute(stmt)).scalars().unique().all())
        counts = await self._counts([c.id for c in customers]) if customers else {}
        rows = []
        for c in customers:
            rows.append(
                (
                    c,
                    {
                        k: counts.get(k, {}).get(c.id, 0)
                        for k in ("orders", "appointments", "enquiries", "looks", "wishlist")
                    },
                )
            )
        return rows, int(total)

    async def get_customer(self, customer_id: uuid.UUID) -> tuple[Customer, dict[str, int]]:
        customer = (
            await self.db.execute(
                select(Customer)
                .options(selectinload(Customer.user))
                .where(Customer.id == customer_id)
            )
        ).scalar_one_or_none()
        if customer is None:
            raise NotFoundError(code="customer_not_found")
        counts = await self._counts([customer.id])
        return customer, {
            k: counts.get(k, {}).get(customer.id, 0)
            for k in ("orders", "appointments", "enquiries", "looks", "wishlist")
        }

    # --- orders / enquiries / appointments / looks ------------------------------------------

    async def list_orders(
        self, *, status: str | None, q: str | None, page: int, page_size: int
    ) -> tuple[list[Order], int]:
        stmt = select(Order).options(*ORDER_OPTIONS)
        if status:
            stmt = stmt.where(Order.status == status)
        if q:
            term = f"%{escape_like(q.strip())}%"
            stmt = stmt.where(
                (Order.order_number.ilike(term))
                | (Order.contact_name.ilike(term))
                | (Order.contact_phone.ilike(term))
            )
        total = (
            await self.db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
        ).scalar_one()
        stmt = stmt.order_by(Order.placed_at.desc()).offset((page - 1) * page_size).limit(page_size)
        return list((await self.db.execute(stmt)).scalars().unique().all()), int(total)

    async def get_order(self, order_id: uuid.UUID) -> Order:
        order = (
            (
                await self.db.execute(
                    select(Order).options(*ORDER_OPTIONS).where(Order.id == order_id)
                )
            )
            .scalars()
            .unique()
            .one_or_none()
        )
        if order is None:
            raise NotFoundError(code="order_not_found")
        return order

    async def update_order(
        self,
        order_id: uuid.UUID,
        *,
        status: OrderStatus | None,
        staff_notes: str | None,
        mark_paid: bool,
    ) -> Order:
        order = await self.get_order(order_id)
        if staff_notes is not None:
            order.staff_notes = staff_notes
        if mark_paid:
            order.status = OrderStatus.PAID.value
            order.paid_at = datetime.now(UTC)
            for payment in order.payments:
                if payment.status == PaymentStatus.CREATED.value:
                    payment.status = PaymentStatus.CAPTURED.value
        if status is not None:
            order.status = status.value
            if status == OrderStatus.CANCELLED:
                order.cancelled_at = datetime.now(UTC)
        await self.db.flush()
        return await self.get_order(order_id)

    async def list_enquiries(
        self, *, status: str | None, page: int, page_size: int
    ) -> tuple[list[Enquiry], int]:
        stmt = select(Enquiry)
        if status:
            stmt = stmt.where(Enquiry.status == status)
        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        stmt = (
            stmt.order_by(Enquiry.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        return list((await self.db.execute(stmt)).scalars().unique().all()), int(total)

    async def _check_staff(self, staff_id: object) -> None:
        if staff_id is None:
            return
        user = await self.db.get(User, staff_id)
        if user is None or not set(user.role_names) & {"admin", "manager", "sales_staff"}:
            raise NotFoundError("That staff member doesn't exist.", code="staff_not_found")

    async def update_enquiry(self, enquiry_id: uuid.UUID, **changes: object) -> Enquiry:
        enquiry = await self.db.get(Enquiry, enquiry_id)
        if enquiry is None:
            raise NotFoundError(code="enquiry_not_found")
        await self._check_staff(changes.get("assigned_staff_id"))
        for key, value in changes.items():
            if value is None:
                continue
            if key == "status":
                enquiry.status = value.value if hasattr(value, "value") else str(value)
                if enquiry.status in {"resolved", "closed"}:
                    enquiry.resolved_at = datetime.now(UTC)
            else:
                setattr(enquiry, key, value)
        await self.db.flush()
        await self.db.refresh(enquiry, attribute_names=["product"])
        return enquiry

    async def list_appointments(
        self,
        *,
        status: str | None,
        store_id: uuid.UUID | None,
        day: datetime | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Appointment], int]:
        stmt = select(Appointment)
        if status:
            stmt = stmt.where(Appointment.status == status)
        if store_id:
            stmt = stmt.where(Appointment.store_id == store_id)
        if day:
            stmt = stmt.where(
                Appointment.starts_at >= day, Appointment.starts_at < day + timedelta(days=1)
            )
        total = (
            await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        stmt = (
            stmt.order_by(Appointment.starts_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list((await self.db.execute(stmt)).scalars().unique().all()), int(total)

    async def update_appointment(self, appointment_id: uuid.UUID, **changes: object) -> Appointment:
        appointment = await self.db.get(Appointment, appointment_id)
        if appointment is None:
            raise NotFoundError(code="appointment_not_found")
        await self._check_staff(changes.get("assigned_staff_id"))
        for key, value in changes.items():
            if value is None:
                continue
            setattr(appointment, key, value.value if hasattr(value, "value") else value)
        await self.db.flush()
        return appointment

    async def list_looks(self, *, page: int, page_size: int) -> tuple[list[SavedLook], int]:
        stmt = select(SavedLook).options(*LOOK_OPTIONS)
        total = (await self.db.execute(select(func.count()).select_from(SavedLook))).scalar_one()
        stmt = (
            stmt.order_by(SavedLook.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list((await self.db.execute(stmt)).scalars().unique().all()), int(total)

    # --- analytics -------------------------------------------------------------------------------

    async def _top_products(
        self, event_type: AnalyticsEventType, since: datetime, limit: int
    ) -> list[tuple[Product, int]]:
        stmt = (
            select(AnalyticsEvent.product_id, func.count().label("n"))
            .where(
                AnalyticsEvent.event_type == event_type.value,
                AnalyticsEvent.occurred_at >= since,
                AnalyticsEvent.product_id.is_not(None),
            )
            .group_by(AnalyticsEvent.product_id)
            .order_by(func.count().desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).all()
        if not rows:
            return []
        products = {
            p.id: p
            for p in (
                await self.db.execute(
                    select(Product)
                    .options(selectinload(Product.images))
                    .where(Product.id.in_([r[0] for r in rows]))
                )
            )
            .scalars()
            .unique()
        }
        return [(products[pid], int(n)) for pid, n in rows if pid in products]

    async def _per_day(
        self, event_type: AnalyticsEventType | None, since: datetime, *, orders: bool = False
    ) -> list[tuple[str, int]]:
        if orders:
            day = cast(Order.placed_at, Date)
            stmt = (
                select(day, func.count())
                .where(Order.placed_at >= since)
                .group_by(day)
                .order_by(day)
            )
        else:
            assert event_type is not None
            day = cast(AnalyticsEvent.occurred_at, Date)
            stmt = (
                select(day, func.count())
                .where(
                    AnalyticsEvent.event_type == event_type.value,
                    AnalyticsEvent.occurred_at >= since,
                )
                .group_by(day)
                .order_by(day)
            )
        return [(str(d), int(n)) for d, n in (await self.db.execute(stmt)).all()]

    async def _count_events(self, event_type: AnalyticsEventType, since: datetime) -> int:
        return int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(AnalyticsEvent)
                    .where(
                        AnalyticsEvent.event_type == event_type.value,
                        AnalyticsEvent.occurred_at >= since,
                    )
                )
            ).scalar_one()
        )

    async def overview(self, *, days: int, limit: int = 8) -> Overview:
        since = datetime.now(UTC) - timedelta(days=days)
        totals = {
            "customers": int(
                (await self.db.execute(select(func.count()).select_from(Customer))).scalar_one()
            ),
            "new_customers": int(
                (
                    await self.db.execute(
                        select(func.count())
                        .select_from(Customer)
                        .where(Customer.created_at >= since)
                    )
                ).scalar_one()
            ),
            "products": int(
                (
                    await self.db.execute(
                        select(func.count()).select_from(Product).where(Product.is_active.is_(True))
                    )
                ).scalar_one()
            ),
            "orders": int(
                (
                    await self.db.execute(
                        select(func.count()).select_from(Order).where(Order.placed_at >= since)
                    )
                ).scalar_one()
            ),
            "appointments": int(
                (
                    await self.db.execute(
                        select(func.count())
                        .select_from(Appointment)
                        .where(Appointment.created_at >= since)
                    )
                ).scalar_one()
            ),
            "enquiries": int(
                (
                    await self.db.execute(
                        select(func.count()).select_from(Enquiry).where(Enquiry.created_at >= since)
                    )
                ).scalar_one()
            ),
            "open_enquiries": int(
                (
                    await self.db.execute(
                        select(func.count())
                        .select_from(Enquiry)
                        .where(Enquiry.status.in_(["new", "in_progress"]))
                    )
                ).scalar_one()
            ),
            "pending_appointments": int(
                (
                    await self.db.execute(
                        select(func.count())
                        .select_from(Appointment)
                        .where(Appointment.status == "requested")
                    )
                ).scalar_one()
            ),
            "tryons": await self._count_events(AnalyticsEventType.PRODUCT_TRYON, since),
            "looks": int(
                (
                    await self.db.execute(
                        select(func.count())
                        .select_from(SavedLook)
                        .where(SavedLook.created_at >= since)
                    )
                ).scalar_one()
            ),
            "wishlist_adds": await self._count_events(AnalyticsEventType.PRODUCT_WISHLIST, since),
        }
        revenue_paid = (
            await self.db.execute(
                select(func.coalesce(func.sum(Order.grand_total), 0)).where(
                    Order.placed_at >= since,
                    Order.status.in_(
                        [
                            s.value
                            for s in (
                                OrderStatus.PAID,
                                OrderStatus.CONFIRMED,
                                OrderStatus.READY_FOR_PICKUP,
                                OrderStatus.SHIPPED,
                                OrderStatus.DELIVERED,
                            )
                        ]
                    ),
                )
            )
        ).scalar_one()
        revenue_pending = (
            await self.db.execute(
                select(func.coalesce(func.sum(Order.grand_total), 0)).where(
                    Order.placed_at >= since,
                    Order.status.in_(
                        [OrderStatus.PENDING.value, OrderStatus.AWAITING_PAYMENT.value]
                    ),
                )
            )
        ).scalar_one()
        stylist = int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(StylistRequest)
                    .where(StylistRequest.created_at >= since)
                )
            ).scalar_one()
        )
        return Overview(
            range_days=days,
            totals=totals,
            revenue={"paid": Decimal(revenue_paid), "pending": Decimal(revenue_pending)},
            most_tried=await self._top_products(AnalyticsEventType.PRODUCT_TRYON, since, limit),
            most_viewed=await self._top_products(AnalyticsEventType.PRODUCT_VIEW, since, limit),
            most_wishlisted=await self._top_products(
                AnalyticsEventType.PRODUCT_WISHLIST, since, limit
            ),
            most_shared=await self._top_products(AnalyticsEventType.PRODUCT_SHARE, since, limit),
            most_enquired=await self._top_products(
                AnalyticsEventType.PRODUCT_ENQUIRY, since, limit
            ),
            most_purchased=await self._top_products(
                AnalyticsEventType.PRODUCT_PURCHASE, since, limit
            ),
            tryons_per_day=await self._per_day(AnalyticsEventType.PRODUCT_TRYON, since),
            orders_per_day=await self._per_day(None, since, orders=True),
            stylist_queries=stylist,
            visual_searches=await self._count_events(AnalyticsEventType.VISUAL_SEARCH, since),
        )
