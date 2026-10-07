from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class AnalyticsEvent(UUIDPrimaryKeyMixin, Base):
    """Append-only business event stream powering the admin analytics."""

    __tablename__ = "analytics_events"
    __table_args__ = (
        Index("ix_analytics_events_type_time", "event_type", "occurred_at"),
        Index("ix_analytics_events_product_time", "product_id", "occurred_at"),
    )

    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL")
    )
    session_token: Mapped[str | None] = mapped_column(String(64))
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL")
    )
    saved_look_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("saved_looks.id", ondelete="SET NULL")
    )
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    user_agent: Mapped[str | None] = mapped_column(String(255))
    source: Mapped[str | None] = mapped_column(String(32))  # web, pwa, admin
