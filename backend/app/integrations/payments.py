"""Payment provider abstraction.

``NullPaymentProvider`` covers pay-at-store and bank transfer (settled by staff in the
admin dashboard). ``RazorpayProvider`` implements Razorpay Orders + signature verification
over plain HTTPS and is active only when ``PAYMENT_PROVIDER=razorpay`` and the keys are
configured. No provider ever pretends a payment succeeded.
"""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Protocol

import httpx

from app.core.errors import ServiceUnavailableError
from app.core.logging import get_logger
from app.core.settings import Settings

log = get_logger(__name__)
UNAVAILABLE = "Online payment is temporarily unavailable. You can still pay at the store."


@dataclass(frozen=True)
class ProviderOrder:
    provider: str
    provider_order_id: str | None
    checkout: dict[str, Any] | None
    raw: dict[str, Any] | None


class PaymentProvider(Protocol):
    name: str

    async def create_order(
        self, *, amount: Decimal, currency: str, receipt: str, notes: dict[str, str]
    ) -> ProviderOrder: ...

    def verify_payment(
        self, *, provider_order_id: str, provider_payment_id: str, signature: str
    ) -> bool: ...

    def verify_webhook(self, *, body: bytes, signature: str) -> bool: ...


class NullPaymentProvider:
    name = "none"

    async def create_order(
        self, *, amount: Decimal, currency: str, receipt: str, notes: dict[str, str]
    ) -> ProviderOrder:
        return ProviderOrder(provider="none", provider_order_id=None, checkout=None, raw=None)

    def verify_payment(
        self, *, provider_order_id: str, provider_payment_id: str, signature: str
    ) -> bool:
        return False

    def verify_webhook(self, *, body: bytes, signature: str) -> bool:
        return False


class RazorpayProvider:
    name = "razorpay"
    base_url = "https://api.razorpay.com/v1"

    def __init__(
        self,
        key_id: str,
        key_secret: str,
        webhook_secret: str | None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret
        self._client = client

    async def create_order(
        self, *, amount: Decimal, currency: str, receipt: str, notes: dict[str, str]
    ) -> ProviderOrder:
        payload = {
            "amount": int(amount * 100),
            "currency": currency,
            "receipt": receipt[:40],
            "notes": notes,
        }
        client = self._client or httpx.AsyncClient(timeout=20)
        try:
            response = await client.post(
                f"{self.base_url}/orders", json=payload, auth=(self.key_id, self.key_secret)
            )
        except httpx.HTTPError as exc:
            log.exception("razorpay_order_failed")
            raise ServiceUnavailableError(UNAVAILABLE, code="payment_unavailable") from exc
        finally:
            if self._client is None:
                await client.aclose()
        if response.status_code >= 400:
            log.error(
                "razorpay_order_rejected", status=response.status_code, body=response.text[:500]
            )
            raise ServiceUnavailableError(UNAVAILABLE, code="payment_unavailable")
        data = response.json()
        return ProviderOrder(
            provider="razorpay",
            provider_order_id=data["id"],
            checkout={
                "key_id": self.key_id,
                "order_id": data["id"],
                "amount": data["amount"],
                "currency": data["currency"],
            },
            raw=data,
        )

    def verify_payment(
        self, *, provider_order_id: str, provider_payment_id: str, signature: str
    ) -> bool:
        message = f"{provider_order_id}|{provider_payment_id}".encode()
        expected = hmac.new(self.key_secret.encode(), message, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def verify_webhook(self, *, body: bytes, signature: str) -> bool:
        if not self.webhook_secret:
            return False
        expected = hmac.new(self.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


def build_payment_provider(settings: Settings) -> PaymentProvider:
    if settings.payment_provider == "razorpay":
        if not (settings.razorpay_key_id and settings.razorpay_key_secret):
            raise RuntimeError(
                "PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET"
            )
        return RazorpayProvider(
            settings.razorpay_key_id, settings.razorpay_key_secret, settings.razorpay_webhook_secret
        )
    return NullPaymentProvider()
