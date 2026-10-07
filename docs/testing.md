# Testing

| Suite | Command | What it covers |
|-------|---------|----------------|
| AI engine | `cd backend && .venv/bin/pytest ../ai/tests` | anchor geometry on replayed landmarks, fitting maths, compositor, ring size, engine orchestration; MediaPipe smoke tests (skipped if models absent) |
| Backend | `cd backend && .venv/bin/pytest` | auth flows, RBAC matrix, catalogue, uploads abuse, try-on API (real engine), engagement, commerce, payments (mocked Razorpay), stylist (mocked LLM), visual search, admin |
| Frontend unit | `cd frontend && npm test` | UI primitives, API client, hooks, fitting port parity with Python fixtures, viewer utilities |
| End-to-end | `npm run test:e2e` | Playwright desktop + mobile against real servers: smoke, try-on, shop journey, admin |
| Static | `make lint typecheck` | ESLint (0 warnings), Ruff, `tsc`, mypy strict |

Backend tests run against a real PostgreSQL database (`TEST_DATABASE_URL`, default
`jewelora_test`), one transaction per test rolled back at the end.

## Conventions

- Every bug fix adds a regression test next to the feature it touched.
- Customer-facing error messages are asserted (never raw tracebacks).
- Authorisation tests cover each role explicitly (`tests/security/test_authorization.py`).
- Fitting changes must keep `ai/tests/fixtures/fitting_expectations.json` and the TypeScript
  parity test in sync: regenerate with `backend/.venv/bin/python scripts/export_fitting_fixtures.py`.
- Visual checks: `scripts/tryon_smoke.py` renders fixture photos for eyeballing placements.

## CI

`.github/workflows/ci.yml` runs frontend (lint, typecheck, unit, build), backend+AI (lint,
mypy, migrations apply + `alembic check`, tests) and Playwright E2E (seeded database, built
frontend) on every pull request and push to `main`/`develop`.
