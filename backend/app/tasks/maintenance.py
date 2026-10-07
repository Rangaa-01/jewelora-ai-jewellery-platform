"""Housekeeping jobs: expired customer photos, stale guest carts, embedding indexing.

Run from the CLI (``python -m app.cli cleanup`` / ``index-embeddings``) via cron or a
scheduler; they are idempotent and safe to repeat.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.settings import Settings
from app.models.commerce import Cart
from app.models.tryon import CustomerPhoto, TryOnResult
from app.models.user import OtpCode, RefreshToken
from app.storage import ObjectStorage

log = get_logger(__name__)


async def purge_expired_photos(db: AsyncSession, storage: ObjectStorage) -> int:
    """Delete customer photos (and derived results) past their retention date."""
    now = datetime.now(UTC)
    stmt = select(CustomerPhoto).where(
        CustomerPhoto.expires_at <= now, CustomerPhoto.is_deleted.is_(False)
    )
    photos = list((await db.execute(stmt)).scalars().all())
    for photo in photos:
        results = (
            (await db.execute(select(TryOnResult).where(TryOnResult.photo_id == photo.id)))
            .scalars()
            .all()
        )
        for result in results:
            if result.result_storage_key:
                await storage.delete(result.result_storage_key)
                result.result_storage_key = None
        await storage.delete(photo.storage_key)
        photo.is_deleted = True
        photo.landmarks = None
    await db.flush()
    log.info("photos_purged", count=len(photos))
    return len(photos)


async def purge_stale_auth_artifacts(db: AsyncSession) -> None:
    now = datetime.now(UTC)
    await db.execute(delete(RefreshToken).where(RefreshToken.expires_at < now - timedelta(days=7)))
    await db.execute(delete(OtpCode).where(OtpCode.expires_at < now - timedelta(days=1)))
    await db.execute(
        delete(Cart).where(Cart.customer_id.is_(None), Cart.updated_at < now - timedelta(days=45))
    )
    await db.flush()


async def run_cleanup(
    db: AsyncSession, storage: ObjectStorage, settings: Settings
) -> dict[str, int]:
    purged = await purge_expired_photos(db, storage)
    await purge_stale_auth_artifacts(db)
    return {"photos_purged": purged}
