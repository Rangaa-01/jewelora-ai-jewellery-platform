"""Staff/customer notifications for appointments, enquiries and orders.

Delivery is pluggable. Without SMTP configured, notifications are logged (structured) so
they are visible in development and in log pipelines; the admin dashboard is always the
system of record.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Protocol
from urllib.parse import urlparse

from app.core.logging import get_logger
from app.core.settings import Settings

log = get_logger(__name__)


class Notifier(Protocol):
    async def send(self, *, to: str, subject: str, body: str) -> None: ...


class LoggingNotifier:
    async def send(self, *, to: str, subject: str, body: str) -> None:
        log.info("notification", to=to, subject=subject, body=body[:500])


class SmtpNotifier:
    def __init__(self, smtp_url: str, sender: str) -> None:
        parsed = urlparse(smtp_url)
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 587
        self.username = parsed.username
        self.password = parsed.password
        self.use_tls = parsed.scheme in {"smtps", "smtp+tls"}
        self.sender = sender

    async def send(self, *, to: str, subject: str, body: str) -> None:
        import asyncio

        message = EmailMessage()
        message["From"], message["To"], message["Subject"] = self.sender, to, subject
        message.set_content(body)

        def _deliver() -> None:
            with smtplib.SMTP(self.host, self.port, timeout=15) as client:
                if self.use_tls:
                    client.starttls()
                if self.username and self.password:
                    client.login(self.username, self.password)
                client.send_message(message)

        try:
            await asyncio.to_thread(_deliver)
        except (smtplib.SMTPException, OSError):
            log.exception("notification_failed", to=to, subject=subject)


def build_notifier(settings: Settings) -> Notifier:
    if settings.smtp_url:
        return SmtpNotifier(settings.smtp_url, settings.notification_email_from)
    return LoggingNotifier()
