# Jewelora — AI Jewellery Virtual Try-On & Commerce Platform

Jewelora lets a jewellery retailer's customers try necklaces, earrings, rings, bangles,
bridal sets and more on their own photo or live camera, mix and match complete looks,
get AI styling advice, save and share looks, book store visits, enquire and buy — with
a full admin dashboard for the shop team.

| Area | Stack |
|------|-------|
| Frontend | Next.js (App Router) · React · TypeScript strict · Tailwind CSS v4 · Framer Motion · GSAP · Three.js / React Three Fiber · MediaPipe Tasks Vision |
| Backend | FastAPI · SQLAlchemy 2 (async) · Alembic · Pydantic v2 · PostgreSQL |
| AI | `jewelora_ai` Python package (MediaPipe landmarks + segmentation, geometric fitting, compositing, embeddings) |
| Tests | Vitest + React Testing Library · pytest · Playwright |
| Ops | Docker Compose (postgres, backend, frontend, nginx) · GitHub Actions CI |

## What's included

- **Virtual try-on** — photo mode (server-side MediaPipe landmarks, geometric fitting, lighting-matched compositing, hair occlusion, manual adjustments, ring-size estimate) and live camera mode (on-device detection, same fitting maths ported to TypeScript with parity tests). Necklaces, chains, pendants, harams, chokers, earrings, rings, bangles, bracelets, nose rings, maang tikka, waist chains, anklets, bridal sets.
- **Catalogue & 3D** — products with variants (metal/stone), sizes, images, transparent try-on assets with anchors (or automatic cut-outs from ordinary product photos), GLB models; interactive 3D viewer with material switching, presets, fullscreen.
- **AI stylist** — understands budget, occasion, type, metal, stone and style; recommends only catalogue products; optional Claude re-ranking that cannot invent products.
- **Visual search** — image embeddings per product image, exact and similar matches.
- **Mix & match / bridal mode**, saved looks, sharing (WhatsApp, link, image), wishlist with compare, enquiries, store appointments with slot availability, cart and checkout (pay at store, bank transfer, Razorpay-ready).
- **Accounts & roles** — email/phone + password, OTP-ready, refresh-token rotation; admin, manager, sales staff, customer enforced server-side.
- **Admin dashboard** — products/assets (incl. anchor editor), categories, collections, stores, customers, orders, enquiries, appointments, looks, staff, analytics (most tried/viewed/wishlisted/shared/enquired/purchased).
- **Production concerns** — structured logging, rate limiting, hardened uploads, signed private media, PWA shell, Docker, CI, 150+ automated tests.

### Integration boundaries (explicitly not faked)

| Capability | Status | Where to connect |
|------------|--------|------------------|
| OTP delivery (SMS/email) | modelled, disabled until a provider is configured (`OTP_ENABLED`) | `backend/app/integrations/otp_provider.py` |
| Online payments | Razorpay orders + signature/webhook verification implemented; inactive until keys are set | `backend/app/integrations/payments.py` |
| LLM stylist re-ranking | works without a key (deterministic); Claude used when `LLM_PROVIDER=anthropic` | `backend/app/services/stylist_service.py` |
| Generative photoreal refinement | not included; renderer contract documented | `ai/jewelora_ai/rendering/README.md` |
| Email notifications | SMTP when `SMTP_URL` set; otherwise structured log + admin dashboard | `backend/app/integrations/notifications.py` |

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first. Detailed guides live in [`docs/`](docs/).

## Quick start (local development)

Prerequisites: Node.js 24+, Python 3.12 with [`uv`](https://docs.astral.sh/uv/), PostgreSQL 14+
(local server or Docker), `curl`.

```bash
git clone <repo-url> jewelora && cd jewelora

# 1. Databases (creates role `jewelora` and DBs `jewelora`, `jewelora_test`)
PGPASSWORD=<postgres superuser password> ./scripts/setup_local_db.sh

# 2. Dependencies + AI models
make setup

# 3. Configuration
cp backend/.env.example backend/.env           # edit DATABASE_URL / BACKEND_PORT if needed
cp frontend/.env.example frontend/.env.local   # BACKEND_INTERNAL_URL must match BACKEND_PORT

# 4. Schema + development seed data
make migrate
make seed

# 5. Run (backend + frontend)
BACKEND_PORT=8000 make dev
```

Open http://localhost:3000. API docs (development only): http://localhost:8000/api/v1/docs.

Seeded development accounts are printed by `make seed` and listed in `docs/setup.md`.

## Docker

```bash
cp .env.example .env            # set POSTGRES_PASSWORD and SECRET_KEY
docker compose up --build       # http://localhost:8080
```

See [`docs/deployment.md`](docs/deployment.md) for production notes (TLS, S3 storage,
secrets, scaling).

## Everyday commands

| Command | What it does |
|---------|--------------|
| `make dev` | Run backend (uvicorn, reload) and frontend (next dev) together |
| `make lint` / `make typecheck` | ESLint + Ruff / `tsc` + mypy |
| `make test` | Vitest, pytest (backend + AI) |
| `make e2e` | Playwright end-to-end (starts both servers) |
| `make build` | Production frontend build |
| `make migrate` | Apply Alembic migrations |
| `make seed` | Load development seed data (never run against production) |
| `make models` | Download MediaPipe models |

## Repository layout

```
frontend/   Next.js app (customer site + admin)      backend/   FastAPI API + Alembic
ai/         jewelora_ai try-on engine                 database/  dev seed data, SQL init
tests/e2e/  Playwright suite                          docs/      guides
scripts/    developer scripts                         docker/    Dockerfiles, nginx
```

## Documentation

- [Architecture](ARCHITECTURE.md) · [Roadmap](docs/roadmap.md)
- [Setup](docs/setup.md) · [Deployment](docs/deployment.md) · [Troubleshooting](docs/troubleshooting.md)
- [Database](docs/database.md) · [API](docs/api.md) · [AI try-on](docs/ai-tryon.md)
- [Testing](docs/testing.md) · [Security](docs/security.md)

## Contributing

Branches: `main` (releasable), `develop` (integration), `feature/*`. Conventional
commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). CI must be green before merge.
