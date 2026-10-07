# Local development setup

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 24.x (≥ 20.9) | `nvm install 24` |
| Python | 3.12 | installed automatically by `uv venv -p 3.12` |
| uv | ≥ 0.4 | https://docs.astral.sh/uv/ |
| PostgreSQL | 14+ | local service or `docker run -p 5432:5432 postgres:17-alpine` |
| curl, bash | any | model download script |

Linux: `apt-get install libgl1 libglib2.0-0` (OpenCV/MediaPipe runtime libraries).

## 2. Databases

`scripts/setup_local_db.sh` creates role `jewelora` (password `jewelora_dev_password`,
development only) and databases `jewelora` and `jewelora_test` with the `pgcrypto`,
`pg_trgm` and `citext` extensions.

```bash
PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=... ./scripts/setup_local_db.sh
```

Override `JEWELORA_DB_USER` / `JEWELORA_DB_PASSWORD` if you want different credentials
and update `DATABASE_URL` accordingly.

## 3. Install

```bash
make setup   # npm ci (root + frontend), uv venv + install (backend + ai), model download
```

## 4. Configure

- `backend/.env` — copy from `backend/.env.example`. Key values: `DATABASE_URL`,
  `BACKEND_PORT`, `SECRET_KEY`, `STORAGE_BACKEND`.
- `frontend/.env.local` — copy from `frontend/.env.example`. `BACKEND_INTERNAL_URL`
  must point at the backend port.

If port 8000 is busy on your machine set `BACKEND_PORT=8001` in `backend/.env` and
`BACKEND_INTERNAL_URL=http://127.0.0.1:8001` in `frontend/.env.local`.

## 5. Migrate and seed

```bash
make migrate
make seed      # development catalogue, stores, demo accounts
```

Seed accounts (development only, printed by the seeder):

| Role | Email | Password |
|------|-------|----------|
| admin | admin@jewelora.local | `Admin#12345` |
| manager | manager@jewelora.local | `Manager#12345` |
| sales staff | sales@jewelora.local | `Sales#12345` |
| customer | customer@jewelora.local | `Customer#12345` |

## 6. Run

```bash
make dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:${BACKEND_PORT}/api/v1/health · Swagger UI at `/api/v1/docs`

The frontend proxies `/api/v1/*` to the backend, so the browser only talks to one origin.

## 7. Verify

```bash
make check     # lint, typecheck, unit tests
make e2e       # Playwright (desktop + mobile Chromium)
```

## Editor

`frontend/.prettierrc` and Ruff (`backend/pyproject.toml`) define formatting. Run
`npm --prefix frontend run format` and `cd backend && .venv/bin/ruff format . ../ai`.
