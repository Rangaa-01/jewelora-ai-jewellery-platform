# Acceptance checklist (verified 2026-10-07)

Evidence for each item is the command or artefact listed. Re-run `make check`, `make e2e`
and the backend/AI suites before a release.

## Frontend
- [x] Responsive (390 / 820 / 1440 screenshots for home, catalogue, product, try-on, cart, checkout, wishlist, looks, admin) — no horizontal overflow.
- [x] Premium UI: serif/sans typography, tokenised palette, reduced-motion respected, lazy 3D/AI.
- [x] No broken routes: every nav/footer link resolves (Playwright smoke; 38 routes built).
- [x] No console errors in browser checks (only expected 401 from `/auth/me` for guests).
- [x] Accessible: keyboard-operable dialogs/sheets/tabs, labels, focus rings, ≥44px targets, skip link.
- [x] Fast: `next build` static where possible, images via `next/image`, three.js/MediaPipe only on demand, PWA shell.

## AI
- [x] Image upload works (validated, re-encoded, private, expiring) — `tests/test_tryon.py`.
- [x] Try-on pipeline works end to end with real MediaPipe on CC0 fixtures — `ai/tests`, `tests/test_tryon.py`, `tests/e2e/specs/tryon.spec.ts`.
- [x] Positioning works for all 13 placement types (anchor tests + visual smoke `scripts/tryon_smoke.py`).
- [x] Error handling: `no_face`, `no_hand`, `invalid_upload`, `tryon_unavailable`, friendly messages asserted.
- [x] Modular service: `Protocol` stages, fixture detector, documented renderer boundary.
- [x] Live mode: on-device detection, TS fitting port with 81 parity tests, fake-camera E2E.

## 3D
- [x] GLB loads, 360° rotate, zoom, pan, presets, fullscreen, material switching — `viewer3d.spec.ts`.
- [x] Mobile: canvas sized to viewport, demand frameloop, low-end sparkle cut-off.

## Backend
- [x] APIs work: 57 pytest cases incl. live engine runs.
- [x] Validation: Pydantic allow-lists, field-level error details.
- [x] Authentication: argon2id, JWT + rotating refresh with reuse detection, lockout.
- [x] Authorisation: RBAC matrix + object ownership tests (`tests/security/`).
- [x] Errors handled: single envelope, no raw tracebacks, request ids.

## Database
- [x] Migrations apply cleanly; `alembic check` passes (CI).
- [x] Relationships/constraints: FKs, uniques, check constraints, snapshots for orders.
- [x] Indexes on FKs, filters, trigram search, analytics.

## Admin
- [x] Product management incl. images, try-on assets with anchor editor, GLB models — `admin.spec.ts`.
- [x] Customers, orders, enquiries, appointments, looks, staff, analytics.

## Security
- [x] Secrets only via env; production boot guard.
- [x] Upload validation, path traversal and signed private media tests.
- [x] Server-side authorisation; CSRF header; rate limits; proxy trust fixed; review log in `docs/security.md`.

## Testing
- [x] Unit (151 frontend, 20 AI), backend (57), E2E (47 desktop+mobile) pass; build passes.

## Documentation
- [x] README, setup, deployment, architecture, AI, API, database, security, testing, troubleshooting, frontend.

## Known limitations (stated, not hidden)
- Demo catalogue photos are real CC0 museum pieces; the shop replaces them with its own photography via the admin or CSV import (`docs/shop-guide.md`). No demo product carries a 3D model, so the viewer shows once the shop uploads `.glb` files.
- OTP, online payment, SMTP and LLM re-ranking activate only when configured.
- Ring-size estimation is an estimate (calibration constant documented).
- Docker images are written and reviewed but could not be built on the development machine (no Docker installed); CI/deployment hosts should run `docker compose build` first.
