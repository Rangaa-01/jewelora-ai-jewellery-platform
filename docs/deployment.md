# Deployment

## Single host with Docker Compose

```bash
cp .env.example .env
# set POSTGRES_PASSWORD, SECRET_KEY (python -c "import secrets; print(secrets.token_urlsafe(48))"),
# PUBLIC_BASE_URL=https://shop.example.com, APP_ENV=production, COOKIE_SECURE=true,
# STORAGE_BACKEND=s3 + S3_* (or keep local storage ONLY for staging)
docker compose up -d --build
```

Services: `postgres` (volume `postgres-data`), `migrate` (one-shot `alembic upgrade head`),
`backend` (uvicorn, models baked into the image), `frontend` (Next standalone),
`nginx` (single origin on `HTTP_PORT`). Put TLS in front of nginx (Caddy/Traefik/cloud LB)
or add a 443 server block with certificates.

Production guard: the backend refuses to start with `APP_ENV=production` if the secret is the
dev default, cookies are not secure, debug is on, the dev DB password is used or storage is
local.

## Platform hosting

- **Frontend** (Vercel/Netlify/Node host): build `frontend/`, set `BACKEND_INTERNAL_URL`
  (server-side reach to the API) and `NEXT_PUBLIC_APP_URL`. The `/api/v1/*` rewrite keeps a
  single origin so cookies stay first-party.
- **Backend** (Fly/Render/ECS/K8s): image from `docker/backend.Dockerfile`, run
  `alembic upgrade head` as a release command, env from `backend/.env.example`. Needs
  `libgl1 libglib2.0-0` (in the image). 2 vCPU / 2 GB is enough for a shop; try-on is CPU
  bound (~0.5–1.5 s per photo) so scale workers horizontally.
- **Storage**: S3-compatible bucket; `S3_PUBLIC_BASE_URL` = CDN for the `public/` prefix.
- **Database**: managed PostgreSQL 14+; enable `pg_trgm`, `citext`, `pgcrypto`.

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Required in production:
`SECRET_KEY`, `DATABASE_URL`, `PUBLIC_BASE_URL`, `FRONTEND_ORIGIN`, `COOKIE_SECURE=true`,
`STORAGE_BACKEND=s3` + `S3_*`, `TRUSTED_HOSTS`. Optional: `REDIS_URL` (shared rate limits),
`LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`, `PAYMENT_PROVIDER=razorpay` + keys,
`SMTP_URL`, `OTP_ENABLED` (+ an OTP provider implementation).

## Scheduled jobs

- `python -m app.cli cleanup` — daily (photo retention, stale tokens, abandoned guest carts).
- `python -m app.cli index-embeddings` — after bulk image imports (uploads via the admin
  API index automatically).

## Scaling notes

- Rate limiter storage: set `REDIS_URL` when running more than one backend replica.
- Next.js: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` identically on all replicas.
- The MediaPipe engine is loaded once per process; use several uvicorn workers or replicas.

## Release checklist

1. `make check` and `make e2e` green on the release branch.
2. Database backup.
3. Deploy backend (migrations run first), then frontend.
4. Verify `/api/v1/health`, sign in as staff, run a try-on on staging.
