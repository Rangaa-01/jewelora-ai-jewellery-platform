from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    CurrentCustomerDep,
    DBDep,
    OptionalUserDep,
    SessionTokenDep,
    SettingsDep,
    StorageDep,
)
from app.core.rate_limit import PUBLIC_FORM_LIMIT, limiter
from app.integrations.notifications import build_notifier
from app.models.catalogue import Product
from app.models.engagement import Appointment
from app.schemas.engagement import AppointmentIn, AppointmentOut, AppointmentSlotOut
from app.services.catalogue_service import CatalogueService
from app.services.engagement_serializers import appointment_out
from app.services.engagement_service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["appointments"])


async def _products_for(db: AsyncSession, appointment: Appointment) -> list[Product]:
    ids = [uuid.UUID(p) for p in appointment.product_ids]
    return await CatalogueService(db).get_products_by_ids(ids) if ids else []


@router.get("/slots", response_model=list[AppointmentSlotOut])
async def slots(
    db: DBDep, settings: SettingsDep, store_id: uuid.UUID = Query(...), day: date = Query(...)
) -> list[AppointmentSlotOut]:
    service = AppointmentService(db, settings, build_notifier(settings))
    day_dt = datetime(day.year, day.month, day.day, tzinfo=UTC)
    return [
        AppointmentSlotOut(starts_at=s, ends_at=e, available=a)
        for s, e, a in await service.slots(store_id, day_dt)
    ]


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(PUBLIC_FORM_LIMIT)
async def book(
    request: Request,
    data: AppointmentIn,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> AppointmentOut:
    customer = user.customer if user and user.customer else None
    service = AppointmentService(db, settings, build_notifier(settings))
    appointment = await service.book(
        data,
        customer=customer,
        session_token=session_token,
        user_agent=request.headers.get("user-agent"),
    )
    return appointment_out(appointment, await _products_for(db, appointment), storage)


@router.get("", response_model=list[AppointmentOut])
async def my_appointments(
    customer: CurrentCustomerDep, db: DBDep, storage: StorageDep, settings: SettingsDep
) -> list[AppointmentOut]:
    service = AppointmentService(db, settings, build_notifier(settings))
    out = []
    for appointment in await service.list_mine(customer):
        out.append(appointment_out(appointment, await _products_for(db, appointment), storage))
    return out


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel(
    appointment_id: uuid.UUID,
    customer: CurrentCustomerDep,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> AppointmentOut:
    service = AppointmentService(db, settings, build_notifier(settings))
    appointment = await service.cancel_mine(customer, appointment_id)
    return appointment_out(appointment, await _products_for(db, appointment), storage)
