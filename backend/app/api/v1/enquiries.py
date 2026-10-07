from __future__ import annotations

from fastapi import APIRouter, Request, status

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
from app.schemas.engagement import EnquiryIn, EnquiryOut
from app.services.engagement_serializers import enquiry_out
from app.services.engagement_service import EnquiryService

router = APIRouter(prefix="/enquiries", tags=["enquiries"])


@router.post("", response_model=EnquiryOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(PUBLIC_FORM_LIMIT)
async def create_enquiry(
    request: Request,
    data: EnquiryIn,
    db: DBDep,
    storage: StorageDep,
    settings: SettingsDep,
    user: OptionalUserDep,
    session_token: SessionTokenDep,
) -> EnquiryOut:
    customer = user.customer if user and user.customer else None
    service = EnquiryService(db, settings, build_notifier(settings))
    enquiry = await service.create(
        data,
        customer=customer,
        session_token=session_token,
        user_agent=request.headers.get("user-agent"),
    )
    return enquiry_out(enquiry, storage)


@router.get("", response_model=list[EnquiryOut])
async def my_enquiries(
    customer: CurrentCustomerDep, db: DBDep, storage: StorageDep, settings: SettingsDep
) -> list[EnquiryOut]:
    service = EnquiryService(db, settings, build_notifier(settings))
    return [enquiry_out(e, storage) for e in await service.list_mine(customer)]
