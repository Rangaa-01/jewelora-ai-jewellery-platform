# Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `503 tryon_unavailable` / capabilities shows `photo_tryon: false` | MediaPipe models missing | `make models` (or set `AI_MODELS_DIR`); check `ai/models/*.task` exist |
| Try-on returns `no_face` on a clear portrait | face smaller than ~60 px or heavily turned | ask for a closer, front-facing photo; the engine's warnings are customer-safe |
| Live try-on stuck on "Loading models" | `frontend/public/models` empty or CSP blocking the WASM CDN | `make models` copies them; see `connect-src` in `next.config.ts` |
| `403 csrf_rejected` from the browser | request without `X-Requested-With: jewelora` | use the shared API client (`src/lib/api/client.ts`) |
| `401` right after login in dev | backend on another port than `BACKEND_INTERNAL_URL` | align `BACKEND_PORT` (backend/.env) and `BACKEND_INTERNAL_URL` (frontend/.env.local) |
| Backend refuses to start in production | insecure settings | read the message: SECRET_KEY, COOKIE_SECURE, DEBUG, DATABASE_URL, STORAGE_BACKEND |
| `alembic check` fails in CI | model changed without migration | `alembic revision --autogenerate`, review, commit |
| Images 404 with `STORAGE_BACKEND=local` behind nginx | `/api/` not proxied to the backend | check `docker/nginx.conf` location blocks |
| Visual search returns nothing | no embeddings | `python -m app.cli index-embeddings` |
| Seed fails with email validation error | `.local`/`.test` domains are rejected | use a real-looking domain (seed uses `jewelora-demo.com`) |
| `slow_request` warnings on `/products` | missing indexes / cold cache | ensure migrations applied (trigram index); first request warms the pool |
| Playwright can't start servers | ports busy | set `BACKEND_PORT`/`E2E_BASE_URL`, or run servers yourself (`reuseExistingServer`) |
| Razorpay `payment_method_unavailable` | provider not configured | set `PAYMENT_PROVIDER=razorpay` and keys; otherwise offer pay-at-store |

Logs: structured (`LOG_JSON=true` in production). Every response carries `X-Request-ID`;
search logs by `request_id`. AI failures log `tryon_failed`/`tryon_engine_error` with the
result id.
