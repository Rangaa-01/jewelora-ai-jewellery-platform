from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import user_out
from app.core.deps import CurrentCustomerDep, CurrentUserDep, DBDep
from app.models.user import Customer, User
from app.schemas.auth import CustomerProfileOut, CustomerProfileUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


def profile_out(customer: Customer, user: User) -> CustomerProfileOut:
    return CustomerProfileOut(
        id=customer.id,
        user=user_out(user),
        gender=customer.gender,
        preferred_metal=customer.preferred_metal,
        preferred_store_id=customer.preferred_store_id,
        ring_size_estimate=customer.ring_size_estimate,
        marketing_opt_in=customer.marketing_opt_in,
        address_line1=customer.address_line1,
        address_line2=customer.address_line2,
        city=customer.city,
        state=customer.state,
        postal_code=customer.postal_code,
        country=customer.country,
    )


@router.get("/me", response_model=CustomerProfileOut)
async def my_profile(customer: CurrentCustomerDep, user: CurrentUserDep) -> CustomerProfileOut:
    return profile_out(customer, user)


@router.patch("/me", response_model=CustomerProfileOut)
async def update_my_profile(
    data: CustomerProfileUpdate, customer: CurrentCustomerDep, user: CurrentUserDep, db: DBDep
) -> CustomerProfileOut:
    changes = data.model_dump(exclude_unset=True)
    if changes.get("full_name"):
        user.full_name = changes.pop("full_name")
    for key, value in changes.items():
        setattr(customer, key, value)
    await db.flush()
    return profile_out(customer, user)
