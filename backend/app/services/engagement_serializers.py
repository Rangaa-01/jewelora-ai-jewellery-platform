from __future__ import annotations

from app.core.settings import Settings
from app.models.catalogue import Product
from app.models.engagement import Appointment, Enquiry, SavedLook, Wishlist, WishlistItem
from app.schemas.engagement import (
    AppointmentOut,
    EnquiryOut,
    PublicLookOut,
    SavedLookItemOut,
    SavedLookOut,
    WishlistItemOut,
    WishlistOut,
)
from app.services.engagement_service import look_total
from app.services.serializers import product_summary_out, store_out
from app.storage import ObjectStorage, url_for_key


def wishlist_item_out(item: WishlistItem, storage: ObjectStorage) -> WishlistItemOut:
    return WishlistItemOut(
        id=item.id,
        product=product_summary_out(item.product, storage)
        if item.product and item.product.is_active
        else None,
        variant_id=item.variant_id,
        saved_look_id=item.saved_look_id,
        note=item.note,
        created_at=item.created_at,
    )


def wishlist_out(wishlist: Wishlist, storage: ObjectStorage, settings: Settings) -> WishlistOut:
    return WishlistOut(
        id=wishlist.id,
        name=wishlist.name,
        items=[wishlist_item_out(i, storage) for i in wishlist.items],
        share_token=wishlist.share_token,
        share_url=f"{settings.public_base_url}/wishlist/shared/{wishlist.share_token}"
        if wishlist.share_token
        else None,
    )


def look_items_out(look: SavedLook, storage: ObjectStorage) -> list[SavedLookItemOut]:
    return [
        SavedLookItemOut(
            id=i.id,
            product=product_summary_out(i.product, storage),
            variant_id=i.variant_id,
            size_id=i.size_id,
            slot=i.slot,
            adjustments=i.adjustments,
        )
        for i in sorted(look.items, key=lambda x: x.sort_order)
    ]


def look_out(look: SavedLook, storage: ObjectStorage, settings: Settings) -> SavedLookOut:
    return SavedLookOut(
        id=look.id,
        title=look.title,
        kind=look.kind,
        preview_url=url_for_key(look.preview_storage_key, storage),
        tryon_result_id=look.tryon_result_id,
        items=look_items_out(look, storage),
        total_price=str(look_total(look)),
        is_public=look.is_public,
        share_token=look.share_token,
        share_url=f"{settings.public_base_url}/looks/{look.share_token}"
        if look.share_token
        else None,
        share_count=look.share_count,
        notes=look.notes,
        created_at=look.created_at,
    )


def public_look_out(look: SavedLook, storage: ObjectStorage) -> PublicLookOut:
    assert look.share_token
    return PublicLookOut(
        token=look.share_token,
        title=look.title,
        kind=look.kind,
        preview_url=url_for_key(look.preview_storage_key, storage),
        items=look_items_out(look, storage),
        total_price=str(look_total(look)),
        created_at=look.created_at,
    )


def appointment_out(
    appointment: Appointment, products: list[Product], storage: ObjectStorage
) -> AppointmentOut:
    return AppointmentOut(
        id=appointment.id,
        reference=appointment.reference,
        store=store_out(appointment.store),
        starts_at=appointment.starts_at,
        ends_at=appointment.ends_at,
        guest_name=appointment.guest_name,
        guest_phone=appointment.guest_phone,
        guest_email=appointment.guest_email,
        party_size=appointment.party_size,
        purpose=appointment.purpose,
        notes=appointment.notes,
        status=appointment.status,
        products=[product_summary_out(p, storage) for p in products],
        saved_look_id=appointment.saved_look_id,
        created_at=appointment.created_at,
    )


def enquiry_out(enquiry: Enquiry, storage: ObjectStorage) -> EnquiryOut:
    return EnquiryOut(
        id=enquiry.id,
        reference=enquiry.reference,
        name=enquiry.name,
        phone=enquiry.phone,
        email=enquiry.email,
        product=product_summary_out(enquiry.product, storage) if enquiry.product else None,
        saved_look_id=enquiry.saved_look_id,
        message=enquiry.message,
        preferred_contact=enquiry.preferred_contact,
        status=enquiry.status,
        created_at=enquiry.created_at,
    )
