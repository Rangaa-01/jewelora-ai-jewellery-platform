"""Human-friendly reference codes for appointments, enquiries and orders."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion


def reference(prefix: str, length: int = 6) -> str:
    return prefix + "".join(secrets.choice(_ALPHABET) for _ in range(length))


def order_number() -> str:
    return f"JW{datetime.now(UTC):%y%m}{''.join(secrets.choice('0123456789') for _ in range(6))}"


def share_token() -> str:
    return secrets.token_urlsafe(18)[:24]
