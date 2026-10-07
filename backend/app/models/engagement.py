from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.catalogue import Product
    from app.models.user import Customer, Store, User


class Wishlist(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "wishlists"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(80), default="My wishlist", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    share_token: Mapped[str | None] = mapped_column(String(32), unique=True)

    customer: Mapped[Customer] = relationship(back_populates="wishlists")
    items: Mapped[list[WishlistItem]] = relationship(
        back_populates="wishlist", cascade="all, delete-orphan", lazy="selectin"
    )


class WishlistItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("wishlist_id", "product_id", "variant_id", "saved_look_id"),)

    wishlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wishlists.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    saved_look_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("saved_looks.id", ondelete="CASCADE")
    )
    note: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    wishlist: Mapped[Wishlist] = relationship(back_populates="items")
    product: Mapped[Product | None] = relationship(lazy="joined")


class SavedLook(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A complete look: one or more products fitted onto a customer photo."""

    __tablename__ = "saved_looks"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), default="look", nullable=False)  # look | bridal
    photo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_photos.id", ondelete="SET NULL")
    )
    tryon_result_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tryon_results.id", ondelete="SET NULL")
    )
    preview_storage_key: Mapped[str | None] = mapped_column(String(512))
    share_token: Mapped[str | None] = mapped_column(String(32), unique=True)
    shared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # link sharing
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # feed opt-in
    public_preview_key: Mapped[str | None] = mapped_column(String(512))  # copy under public/
    share_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    customer: Mapped[Customer] = relationship(back_populates="saved_looks")
    items: Mapped[list[SavedLookItem]] = relationship(
        back_populates="look", cascade="all, delete-orphan", lazy="selectin"
    )


class SavedLookItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "saved_look_items"

    look_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("saved_looks.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL")
    )
    size_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_sizes.id", ondelete="SET NULL")
    )
    slot: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # necklace, earrings, ring_left_4 ...
    adjustments: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB
    )  # manual offset/scale/rotation
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    look: Mapped[SavedLook] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(lazy="joined")


class Appointment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "appointments"
    __table_args__ = (Index("ix_appointments_store_start", "store_id", "starts_at"),)

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False
    )
    reference: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    guest_name: Mapped[str] = mapped_column(String(120), nullable=False)
    guest_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    guest_email: Mapped[str | None] = mapped_column(String(255))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    purpose: Mapped[str | None] = mapped_column(String(40))  # browse, bridal, repair, pickup
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="requested", nullable=False, index=True)
    product_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    saved_look_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("saved_looks.id", ondelete="SET NULL")
    )
    assigned_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    staff_notes: Mapped[str | None] = mapped_column(Text)

    customer: Mapped[Customer | None] = relationship(back_populates="appointments")
    store: Mapped[Store] = relationship(lazy="joined")
    assigned_staff: Mapped[User | None] = relationship(foreign_keys=[assigned_staff_id])


class Enquiry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "enquiries"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), index=True
    )
    saved_look_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("saved_looks.id", ondelete="SET NULL")
    )
    reference: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    preferred_contact: Mapped[str] = mapped_column(String(16), default="phone", nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="new", nullable=False, index=True)
    assigned_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    staff_notes: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    customer: Mapped[Customer | None] = relationship(back_populates="enquiries")
    product: Mapped[Product | None] = relationship(lazy="joined")


class StylistRequest(UUIDPrimaryKeyMixin, Base):
    """Audit record of AI stylist queries, useful for analytics and quality review."""

    __tablename__ = "stylist_requests"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True
    )
    session_token: Mapped[str | None] = mapped_column(String(64))
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_constraints: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    recommended_product_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    llm_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    processing_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
