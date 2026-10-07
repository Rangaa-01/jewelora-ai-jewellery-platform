from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import Customer


class CustomerPhoto(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A photo uploaded by a customer (or an anonymous session) for try-on. Private."""

    __tablename__ = "customer_photos"
    __table_args__ = (Index("ix_customer_photos_session", "session_token"),)

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    session_token: Mapped[str | None] = mapped_column(String(64))  # anonymous owner
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    landmarks: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # cached detection result
    detection_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    customer: Mapped[Customer | None] = relationship(back_populates="photos")


class TryOnSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tryon_sessions"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), index=True
    )
    session_token: Mapped[str | None] = mapped_column(String(64), index=True)
    mode: Mapped[str] = mapped_column(String(8), nullable=False)  # photo | live
    photo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_photos.id", ondelete="SET NULL")
    )
    device_info: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    results: Mapped[list[TryOnResult]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class TryOnResult(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tryon_results"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tryon_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    photo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer_photos.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    items: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )  # product/variant/size/adjustments
    placements: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # fitted transforms per item
    result_storage_key: Mapped[str | None] = mapped_column(String(512))
    result_width: Mapped[int | None] = mapped_column(Integer)
    result_height: Mapped[int | None] = mapped_column(Integer)
    engine_version: Mapped[str | None] = mapped_column(String(32))
    processing_ms: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[float | None] = mapped_column()
    warnings: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_detail: Mapped[str | None] = mapped_column(Text)  # internal only

    session: Mapped[TryOnSession] = relationship(back_populates="results")
