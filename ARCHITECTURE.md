# Jewelora — System Architecture

Jewelora is an AI jewellery virtual try-on and commerce platform built for a real
jewellery retailer. Customers browse a catalogue, try jewellery on a photo or a live
camera feed, mix and match complete looks, get AI styling advice, save and share looks,
book store visits, enquire and purchase. Staff manage the catalogue, customers,
appointments, enquiries and orders from an admin dashboard with analytics.

This document is the authoritative description of how the system is put together.
`docs/` contains deeper material on each area.

---

## 1. System overview

```
                          ┌───────────────────────────────────────────┐
                          │               Browser / PWA               │
                          │  Next.js App Router · React · Tailwind    │
                          │  Framer Motion · GSAP · R3F/Three.js      │
                          │  MediaPipe Tasks (live camera try-on)     │
                          └───────────────┬───────────────────────────┘
                                          │ HTTPS  /api/*  (same origin, rewritten)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FastAPI backend  (backend/)                       │
│  auth · catalogue · try-on · stylist · visual search · wishlist · looks     │
│  appointments · enquiries · orders · admin · analytics                      │
│  ───────────────────────────────────────────────────────────────────────    │
│  Services ──► jewelora_ai (ai/)   ──► MediaPipe models (ai/models/)          │
│           ──► Storage abstraction ──► local disk | S3-compatible bucket      │
│           ──► LLM provider (optional, Anthropic) for stylist explanations    │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ asyncpg
                ▼
        ┌──────────────┐
        │  PostgreSQL  │  Alembic migrations · normalised schema · analytics_events
        └──────────────┘
```

Three deployable units: **frontend** (Node), **backend** (Python; it imports `ai/`
as a library) and **PostgreSQL**. Object storage is an external dependency in
production (any S3-compatible bucket) and a local directory in development.

### Repository layout

```
frontend/      Next.js application (customer site + admin dashboard)
backend/       FastAPI application, Alembic migrations, backend tests
ai/            jewelora_ai Python package: try-on engine, embeddings, size estimation
database/      Development seed data (JSON) and SQL helpers — never production data
tests/e2e/     Playwright end-to-end suite (runs against frontend + backend)
docs/          Architecture, setup, deployment, API, AI, security, testing, troubleshooting
scripts/       Developer scripts: model download, seeding, dev asset generation, checks
docker/        Dockerfiles and nginx config; docker-compose.yml lives at the root
.github/       CI workflow
```

---

## 2. Frontend architecture

**Stack:** Next.js (App Router, React Server Components), React 19, TypeScript strict,
Tailwind CSS v4, Framer Motion (component motion), GSAP + ScrollTrigger (scroll-linked
and timeline animation), Three.js via React Three Fiber + drei (3D viewer and live AR
overlay), `@mediapipe/tasks-vision` (in-browser face/hand/pose landmarks), Zustand
(client state: try-on session, mix & match), TanStack Query (server state), Zod +
React Hook Form (forms), Vitest + React Testing Library (unit), Playwright (E2E).

**Routes** (`frontend/src/app`, App Router; no route groups):

| Route | Purpose |
|-------|---------|
| `/` | Home: hero (procedural 3D ring), try-on intro, featured, collections, 3D experience, how it works, bridal, stylist, visual search, customer looks, appointment, testimonials, trust, CTA |
| `/collections`, `/collections/[slug]`, `/products`, `/products/[slug]` | Catalogue with filters/sort/pagination, product detail with gallery, 3D viewer, variants/sizes, try-on/wishlist/enquiry/appointment CTAs |
| `/try-on`, `/bridal` | Try-on studio: photo mode (server render, adjustments, ring size) and live camera mode (on-device MediaPipe); bridal slot set |
| `/stylist`, `/visual-search` | AI stylist and image search |
| `/wishlist`, `/wishlist/shared/[token]`, `/looks`, `/looks/[token]`, `/cart`, `/checkout` | Engagement and commerce |
| `/appointments/new`, `/enquire` | Store visit booking and enquiries (guest or signed-in) |
| `/account/*` | Login/register, profile, orders, appointments, enquiries, looks |
| `/admin/*` | Staff dashboard (role-aware navigation; backend enforces) |
| `/offline` | PWA offline fallback |

**Talking to the backend.** The browser only ever calls `/api/*` on its own origin.
`next.config.ts` rewrites `/api/:path*` to the backend (`BACKEND_INTERNAL_URL`). This
keeps auth cookies first-party, avoids CORS in production, and lets the same build run
behind nginx or on a platform host. Server components call the backend directly using
the internal URL and forward the request cookies.

**Design system.** `src/styles/tokens.css` defines the theme (ivory/charcoal neutrals,
champagne-gold accent, deep emerald secondary, serif display + sans body). Components in
`src/components/ui` are small, accessible primitives (Button, Input, Dialog, Sheet,
Tabs, Toast, Skeleton, EmptyState, ErrorState). Motion lives in
`src/components/motion` and always checks `prefers-reduced-motion`.

**Heavy resources load lazily.** The 3D viewer, the MediaPipe runtime and WASM, GSAP
plugins and the camera pipeline are all behind `next/dynamic` / dynamic `import()` and
only load on the routes that need them.

**Live try-on runs in the browser.** Landmarks are detected on-device with MediaPipe
Tasks Vision; the jewellery overlay (2D transparent asset or 3D model) is rendered on a
canvas/WebGL layer that tracks the relevant anchors (ears, neck/shoulders, finger
segments, wrist, nose, forehead). No video leaves the device. Only the final frame the
customer chooses to save is uploaded, through the same controlled upload path as
photos.

---

## 3. Backend architecture

**Stack:** FastAPI, Pydantic v2, SQLAlchemy 2 (async, asyncpg), Alembic, PyJWT,
argon2 password hashing, slowapi rate limiting, structlog JSON logging, httpx.

```
backend/app/
  main.py              app factory, middleware, routers, lifespan
  core/                settings, security (JWT/argon2), logging, errors, rate limits, deps
  db/                  engine/session, base model, mixins
  models/              SQLAlchemy models (one file per aggregate)
  schemas/             Pydantic request/response models
  api/v1/              routers: auth, products, catalogue, tryon, stylist, visual_search,
                       wishlist, looks, appointments, enquiries, orders, cart, admin, analytics, uploads
  services/            business logic (no HTTP concerns)
  repositories/        query layer used by services
  storage/             object storage abstraction (local, s3)
  integrations/        external providers: llm (anthropic), payments (razorpay-ready), notifications
  tasks/               background work (embedding indexing, analytics roll-ups)
backend/alembic/       migrations
backend/tests/         pytest (unit + API tests against a real PostgreSQL test DB)
```

**Layering rule:** routers validate and authorise → services implement use-cases →
repositories query the DB. Services never import FastAPI. AI work is delegated to
`jewelora_ai` through a small adapter in `services/tryon_service.py`.

**Authentication.** Email/phone + password. Access tokens are short-lived JWTs;
refresh tokens are opaque, hashed in the DB and rotated. Both are delivered as
`HttpOnly; Secure; SameSite=Lax` cookies; the frontend never handles raw tokens.
OTP login is modelled (`otp_codes` table, provider interface) so an SMS/email provider
can be plugged in; it is disabled until a provider is configured.

**Authorisation.** Roles: `admin`, `manager`, `sales_staff`, `customer`. Every
privileged router uses `require_roles(...)` dependencies; object-level checks (a customer
may only read their own wishlist, looks, photos, orders) are enforced in services.
Frontend role checks are UX only.

**Errors.** All errors are raised as typed `AppError` subclasses and rendered by one
exception handler into `{ "error": { "code", "message", "details?" } }` with safe,
customer-facing messages. Technical detail is logged with a request id, never returned.

**Rate limiting.** slowapi with per-route limits; stricter on auth, uploads and AI
endpoints. Backed by in-memory storage by default and Redis when `REDIS_URL` is set.

---

## 4. AI architecture

The AI layer is a pipeline of replaceable stages behind stable interfaces
(`ai/jewelora_ai/`):

```
TryOnRequest
  → Preprocessor        (EXIF orientation, resize, colour, validation)
  → LandmarkDetector    (face / hands / pose landmarks; MediaPipe implementation)
  → Segmenter           (person/hair/skin masks for occlusion; MediaPipe multiclass)
  → Fitter              (per-jewellery-type anchor geometry → placement transform)
  → Renderer            (warps the transparent asset, applies lighting match, shadow,
                         occlusion by hair/skin mask, composites)
  → Postprocessor       (edge softening, colour harmonisation, export)
TryOnResult (image + placements + confidence + warnings)
```

- **Interfaces** are `Protocol` classes in `jewelora_ai/interfaces.py`. Each stage has a
  production implementation and a deterministic test implementation.
- **Jewellery types** map to anchor strategies in `jewelora_ai/fitting/`: necklace/chain/
  pendant/haram → neck and shoulder lines; earrings → ear tragus/lobe points; nose ring
  → nostril; maang tikka → hairline centre; rings → finger segment and knuckle; bangles/
  bracelets → wrist; waist chain → hips; anklets → ankle.
- **Live mode** uses the same fitting mathematics ported to TypeScript
  (`frontend/src/lib/tryon/fitting/`) so photo and live results agree. Fixture JSON files
  generated from the Python implementation are used to cross-test the TypeScript port.
- **Ring size** is estimated from finger width relative to detected hand scale and is
  always labelled an estimate.
- **Visual search and stylist retrieval** use MediaPipe Image Embedder embeddings stored
  per product image; similarity is cosine distance computed in the service (pgvector is a
  documented upgrade path).
- **AI stylist** parses constraints (budget, occasion, metal, stones, category) and
  retrieves catalogue products deterministically. When an LLM provider is configured it
  only ranks and explains candidates it was given by ID; it can never invent products.
- **Integration boundary.** Generative (diffusion-based) relighting/refinement is not
  included. `jewelora_ai/renderers/README.md` documents the exact `Renderer` contract to
  implement to add one.

Models are downloaded by `scripts/download_models.sh` into `ai/models/` (gitignored).

---

## 5. Database architecture

PostgreSQL 14+ with Alembic migrations (`backend/alembic`). UUID primary keys,
`created_at`/`updated_at` on every table, soft-delete via `is_active` where business
data must be retained.

Core tables: `users`, `roles`, `user_roles`, `refresh_tokens`, `otp_codes`, `customers`
(profile data), `stores`, `product_categories`, `collections`, `products`,
`product_variants` (metal/stone/purity combinations with price deltas),
`product_images`, `product_tryon_assets` (transparent assets with anchor metadata),
`product_3d_assets`, `product_sizes`, `product_collections`, `product_embeddings`,
`metal_rates`, `wishlists`, `wishlist_items`, `saved_looks`, `saved_look_items`,
`customer_photos`, `tryon_sessions`, `tryon_results`, `carts`, `cart_items`, `orders`,
`order_items`, `payments`, `appointments`, `enquiries`, `analytics_events`,
`stylist_requests`.

Indexes on all foreign keys, product search (trigram on name/tags), active/category
filters, analytics event type/time. See `docs/database.md`.

---

## 6. Storage architecture

`backend/app/storage/` defines `ObjectStorage` with `put`, `get`, `delete`,
`signed_url`, `public_url`. Implementations: `LocalStorage` (dev; served through an
authenticated backend route, not a static mount) and `S3Storage` (any S3-compatible
provider; presigned URLs). Buckets/prefixes: `public/products/...` (CDN-friendly) and
`private/customers/<customer_id>/...` (photos and try-on results, signed URLs only,
short expiry). Uploads are validated by size, declared type, magic bytes and a full
decode-and-re-encode step that strips metadata.

---

## 7. Security architecture

- Parameterised queries only (SQLAlchemy); Pydantic validation on every input.
- Argon2id password hashing; JWT access tokens (15 min) + rotating refresh tokens.
- `HttpOnly` cookies with `SameSite=Lax`; state-changing requests from the browser
  require a custom header (`X-Requested-With`) that CSRF attacks cannot set cross-origin.
- Role and object-level authorisation enforced in the backend.
- Upload hardening: size limits, MIME + magic-byte check, Pillow decode with
  decompression-bomb limits, re-encode to strip EXIF, randomised storage keys, no path
  components from clients.
- Rate limits on auth, uploads, AI and public forms. Security headers (CSP,
  HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy for camera).
- Secrets only via environment; `.env` is gitignored; `.env.example` documents keys.
- Structured audit logging of auth events and admin mutations.
- Customer photos are private by default, retention is configurable, and customers can
  delete them.

---

## 8. Testing architecture

| Layer                | Tool                               | Location                 |
|----------------------|------------------------------------|--------------------------|
| AI engine unit       | pytest                             | `ai/tests`               |
| Backend unit + API   | pytest + httpx against test DB     | `backend/tests`          |
| Frontend unit        | Vitest + React Testing Library     | `frontend/src/**/*.test.tsx` |
| Fitting parity       | Vitest with Python-generated fixtures | `frontend/src/lib/tryon/__fixtures__` |
| End-to-end           | Playwright (desktop + mobile)      | `tests/e2e`              |
| Security             | pytest (authz matrix, upload abuse, rate limits) | `backend/tests/security` |

CI runs lint, type check, unit, backend, build and E2E on every pull request.

---

## 9. Deployment architecture

- `docker-compose.yml`: `postgres`, `backend`, `frontend`, `nginx` (single origin,
  TLS termination point, static caching). Optional `minio` profile for S3-compatible
  storage locally.
- Images are multi-stage; the backend image includes MediaPipe models downloaded at
  build time or mounted as a volume.
- Configuration is 100% environment variables (`.env.example` at root, per-service).
- Health endpoints: `GET /api/v1/health` (backend), `/healthz` (frontend).
- Migrations run as a one-shot job (`alembic upgrade head`) before the backend starts.

See `docs/deployment.md`.
