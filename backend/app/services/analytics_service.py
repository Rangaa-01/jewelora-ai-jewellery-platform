"""Append-only business event recording."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsEvent
from app.models.enums import AnalyticsEventType


async def record_event(
    db: AsyncSession,
    event_type: AnalyticsEventType,
    *,
    product_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    session_token: str | None = None,
    saved_look_id: uuid.UUID | None = None,
    properties: dict[str, Any] | None = None,
    user_agent: str | None = None,
    source: str = "web",
) -> None:
    db.add(
        AnalyticsEvent(
            event_type=event_type.value,
            occurred_at=datetime.now(UTC),
            product_id=product_id,
            customer_id=customer_id,
            session_token=session_token,
            saved_look_id=saved_look_id,
            properties=properties or {},
            user_agent=(user_agent or "")[:255] or None,
            source=source,
        )
    )
