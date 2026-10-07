"""Admin operations: customers, staff, orders, enquiries, appointments, looks, analytics."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.appointments import _products_for
from app.api.v1.auth import user_out
from app.api.v1.orders import order_out
from app.core.deps import AdminUserDep, DBDep, SettingsDep, StorageDep, require_roles
from app.core.logging import get_logger
from app.core.settings import get_settings
from app.models.catalogue import Product
from app.models.enums import Role
from app.models.user import Customer
from app.schemas.admin import (
    AdminAppointmentUpdate,
    AdminCustomerDetailOut,
    AdminCustomerOut,
    AdminCustomerUpdate,
    AdminEnquiryUpdate,
    AdminOrderUpdate,
    AdminStaffIn,
    AnalyticsOverviewOut,
    ProductStatOut,
    TimeseriesPointOut,
)
from app.schemas.auth import UserOut
from app.schemas.commerce import OrderOut
from app.schemas.common import Page
from app.schemas.engagement import AppointmentOut, EnquiryOut, SavedLookOut
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService
from app.services.engagement_serializers import appointment_out, enquiry_out, look_out
from app.storage import ObjectStorage, url_for_key

log = get_logger(__name__)
router = APIRouter(
    dependencies=[Depends(require_roles(Role.ADMIN, Role.MANAGER, Role.SALES_STAFF))]
)


def _customer_out(customer: Customer, counts: dict[str, int]) -> AdminCustomerOut:
    return AdminCustomerOut(
        id=customer.id,
        user=user_out(customer.user),
        city=customer.city,
        state=customer.state,
        preferred_metal=customer.preferred_metal,
        marketing_opt_in=customer.marketing_opt_in,
        orders_count=counts["orders"],
        appointments_count=counts["appointments"],
        enquiries_count=counts["enquiries"],
        looks_count=counts["looks"],
        wishlist_count=counts["wishlist"],
        last_login_at=customer.user.last_login_at,
        created_at=customer.created_at,
    )


@router.get("/customers", response_model=Page[AdminCustomerOut])
async def admin_customers(
    db: DBDep,
    q: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> Page[AdminCustomerOut]:
    rows, total = await AdminService(db).list_customers(q=q, page=page, page_size=page_size)
    return Page(
        items=[_customer_out(c, n) for c, n in rows], total=total, page=page, page_size=page_size
    )


@router.get("/customers/{customer_id}", response_model=AdminCustomerDetailOut)
async def admin_customer(customer_id: uuid.UUID, db: DBDep) -> AdminCustomerDetailOut:
    customer, counts = await AdminService(db).get_customer(customer_id)
    base = _customer_out(customer, counts)
    return AdminCustomerDetailOut(
        **base.model_dump(),
        notes=customer.notes,
        phone_verified=customer.user.phone_verified_at is not None,
        email_verified=customer.user.email_verified_at is not None,
    )


@router.patch(
    "/customers/{customer_id}",
    response_model=AdminCustomerDetailOut,
    dependencies=[Depends(require_roles(Role.ADMIN, Role.MANAGER))],
)
async def admin_update_customer(
    customer_id: uuid.UUID, data: AdminCustomerUpdate, db: DBDep, user: AdminUserDep
) -> AdminCustomerDetailOut:
    customer, _ = await AdminService(db).get_customer(customer_id)
    if data.notes is not None:
        customer.notes = data.notes
    if data.is_active is not None:
        customer.user.is_active = data.is_active
        if not data.is_active:
            await AuthService(db, get_settings()).revoke_all_sessions(customer.user)
    await db.flush()
    log.info("admin_customer_updated", customer_id=str(customer_id), by=str(user.id))
    return await admin_customer(customer_id, db)


@router.post(
    "/staff",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(Role.ADMIN))],
)
async def admin_create_staff(
    data: AdminStaffIn, db: DBDep, settings: SettingsDep, user: AdminUserDep
) -> UserOut:
    created = await AuthService(db, settings).create_staff_user(
        full_name=data.full_name,
        email=data.email,
        password=data.password,
        roles=[r for r in data.roles if r != Role.CUSTOMER],
    )
    log.info(
        "admin_staff_created", user_id=str(created.id), roles=created.role_names, by=str(user.id)
    )
    return user_out(created)


@router.get("/orders", response_model=Page[OrderOut])
async def admin_orders(
    db: DBDep,
    storage: StorageDep,
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> Page[OrderOut]:
    orders, total = await AdminService(db).list_orders(
        status=status_filter, q=q, page=page, page_size=page_size
    )
    return Page(
        items=[order_out(o, storage) for o in orders], total=total, page=page, page_size=page_size
    )


@router.get("/orders/{order_id}", response_model=OrderOut)
async def admin_order(order_id: uuid.UUID, db: DBDep, storage: StorageDep) -> OrderOut:
    return order_out(await AdminService(db).get_order(order_id), storage)


@router.patch("/orders/{order_id}", response_model=OrderOut)
async def admin_update_order(
    order_id: uuid.UUID, data: AdminOrderUpdate, db: DBDep, storage: StorageDep
) -> OrderOut:
    order = await AdminService(db).update_order(
        order_id, status=data.status, staff_notes=data.staff_notes, mark_paid=data.mark_paid
    )
    return order_out(order, storage)


@router.get("/enquiries", response_model=Page[EnquiryOut])
async def admin_enquiries(
    db: DBDep,
    storage: StorageDep,
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> Page[EnquiryOut]:
    rows, total = await AdminService(db).list_enquiries(
        status=status_filter, page=page, page_size=page_size
    )
    return Page(
        items=[enquiry_out(e, storage) for e in rows], total=total, page=page, page_size=page_size
    )


@router.patch("/enquiries/{enquiry_id}", response_model=EnquiryOut)
async def admin_update_enquiry(
    enquiry_id: uuid.UUID, data: AdminEnquiryUpdate, db: DBDep, storage: StorageDep
) -> EnquiryOut:
    enquiry = await AdminService(db).update_enquiry(
        enquiry_id, **data.model_dump(exclude_unset=True)
    )
    return enquiry_out(enquiry, storage)


@router.get("/appointments", response_model=Page[AppointmentOut])
async def admin_appointments(
    db: DBDep,
    storage: StorageDep,
    status_filter: str | None = Query(default=None, alias="status"),
    store_id: uuid.UUID | None = Query(default=None),
    day: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> Page[AppointmentOut]:
    day_dt = datetime(day.year, day.month, day.day, tzinfo=UTC) if day else None
    rows, total = await AdminService(db).list_appointments(
        status=status_filter, store_id=store_id, day=day_dt, page=page, page_size=page_size
    )
    items = [appointment_out(a, await _products_for(db, a), storage) for a in rows]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
async def admin_update_appointment(
    appointment_id: uuid.UUID, data: AdminAppointmentUpdate, db: DBDep, storage: StorageDep
) -> AppointmentOut:
    appointment = await AdminService(db).update_appointment(
        appointment_id, **data.model_dump(exclude_unset=True)
    )
    return appointment_out(appointment, await _products_for(db, appointment), storage)


@router.get("/looks", response_model=Page[SavedLookOut])
async def admin_looks(
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> Page[SavedLookOut]:
    rows, total = await AdminService(db).list_looks(page=page, page_size=page_size)
    return Page(
        items=[look_out(look, storage, settings) for look in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def _stat(product: Product, count: int, storage: ObjectStorage) -> ProductStatOut:
    primary = next(
        (i for i in product.images if i.is_primary), product.images[0] if product.images else None
    )
    return ProductStatOut(
        product_id=product.id,
        name=product.name,
        slug=product.slug,
        image_url=url_for_key(primary.storage_key, storage) if primary else None,
        count=count,
    )


@router.get("/analytics/overview", response_model=AnalyticsOverviewOut)
async def admin_analytics(
    db: DBDep, storage: StorageDep, days: int = Query(default=30, ge=1, le=365)
) -> AnalyticsOverviewOut:
    data = await AdminService(db).overview(days=days)
    return AnalyticsOverviewOut(
        range_days=days,
        totals=data.totals,
        revenue=data.revenue,
        most_tried=[_stat(p, n, storage) for p, n in data.most_tried],
        most_viewed=[_stat(p, n, storage) for p, n in data.most_viewed],
        most_wishlisted=[_stat(p, n, storage) for p, n in data.most_wishlisted],
        most_shared=[_stat(p, n, storage) for p, n in data.most_shared],
        most_enquired=[_stat(p, n, storage) for p, n in data.most_enquired],
        most_purchased=[_stat(p, n, storage) for p, n in data.most_purchased],
        tryons_per_day=[TimeseriesPointOut(date=d, count=n) for d, n in data.tryons_per_day],
        orders_per_day=[TimeseriesPointOut(date=d, count=n) for d, n in data.orders_per_day],
        stylist_queries=data.stylist_queries,
        visual_searches=data.visual_searches,
    )
