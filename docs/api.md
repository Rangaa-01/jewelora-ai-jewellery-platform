# API reference

Base path: `/api/v1`. Interactive docs (development only): `/api/v1/docs` (Swagger UI) and
`/api/v1/openapi.json`. All responses are JSON. Errors use one envelope:

```json
{ "error": { "code": "validation_error", "message": "Some of the information provided is not valid.", "details": [{"field": "email", "message": "…"}] } }
```

`message` is always safe to show to customers. `code` is stable and machine-readable.
Unexpected failures return `internal_error` with a `request_id` for support.

## Conventions

- **Auth**: HttpOnly cookies `access_token` (JWT, 15 min) and `refresh_token` (rotating, 30 days).
  Browsers must send `X-Requested-With: jewelora` on POST/PUT/PATCH/DELETE (CSRF guard).
  `Authorization: Bearer <access token>` is also accepted for non-browser clients.
- **Guests** get an `jw_session` cookie on first write (cart, try-on); it is merged into the
  account on sign-in.
- **Pagination**: `?page=&page_size=` → `{ items, total, page, page_size, pages }`.
- **Rate limits** (per user or IP): auth 10/min, OTP 5/min, uploads 20/min, AI 30/min,
  public forms 10/min, search 120/min, default 600/min → `429 rate_limited`.
- **Media**: product assets are public immutable URLs; customer photos and try-on results
  are private, signed URLs (expire after `STORAGE_SIGNED_URL_TTL_SECONDS`).

## Endpoints

| Area | Method & path | Auth | Notes |
|------|---------------|------|-------|
| Health | `GET /health` | – | liveness + DB |
| Auth | `POST /auth/register` `{full_name,email?,phone?,password,marketing_opt_in}` | – | 201, sets cookies |
| | `POST /auth/login` `{identifier,password}` | – | lockout after 8 failures |
| | `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/logout-all` · `GET /auth/me` | cookie | |
| | `POST /auth/change-password` | user | revokes other sessions |
| | `POST /auth/otp/request` · `POST /auth/otp/verify` | – | 503 `otp_disabled` until a provider is configured |
| Profile | `GET/PATCH /customers/me` | customer | |
| Catalogue | `GET /products` | – | filters: `q, category, collection, jewellery_type[], metal_type[], stone_type[], gender, occasion, style, min_price, max_price, tryon_only, in_stock_only, featured, is_new, sort (relevance|newest|price_asc|price_desc|popular)` |
| | `GET /products/{slug}` · `GET /products/{slug}/related` | – | detail includes variants, sizes, images, try-on assets, 3D models, set items |
| | `GET /categories` · `GET /collections?featured=&bridal=` · `GET /collections/{slug}` · `GET /collections/{slug}/products` | – | |
| | `GET /stores` | – | |
| Try-on | `GET /tryon/capabilities` | – | whether AI is available, supported types |
| | `POST /tryon/photo` multipart `photo`, `items` JSON, `mode` | guest/customer | 201 `TryOnResultOut`; errors `no_face`, `no_hand`, `invalid_upload`, `tryon_unavailable` |
| | `POST /tryon/photos/{photo_id}/run` `{items,mode}` | owner | reuse cached landmarks |
| | `GET /tryon/results/{id}` · `POST /tryon/results/{id}/adjust` `{product_id: adjustments}` | owner | |
| | `GET /tryon/photos` · `DELETE /tryon/photos/{id}` | owner | deletion removes derived results |
| Stylist | `POST /stylist/recommend` `{query,budget_max?,occasion?,limit?}` | – | only catalogue products; `llm_used` flag |
| Visual search | `POST /visual-search` multipart `image` | – | exact + similar matches |
| Wishlist | `GET /wishlist` · `POST /wishlist/items` · `DELETE /wishlist/items/{id}` · `POST /wishlist/share` · `GET /wishlist/shared/{token}` | customer (shared: –) | |
| Looks | `GET /looks` · `POST /looks` · `GET/PATCH/DELETE /looks/{id}` · `POST /looks/{id}/share?channel=` · `GET /looks/public` · `GET /looks/shared/{token}` | customer (public: –) | |
| Appointments | `GET /appointments/slots?store_id=&day=` · `POST /appointments` · `GET /appointments` · `POST /appointments/{id}/cancel` | guest/customer | 3 concurrent bookings per slot |
| Enquiries | `POST /enquiries` · `GET /enquiries` | guest/customer | |
| Cart | `GET /cart` · `POST /cart/items` · `PATCH /cart/items/{id}` · `DELETE /cart/items/{id}` | guest/customer | |
| Orders | `POST /orders` · `GET /orders` · `GET /orders/{id}` · `POST /orders/{id}/confirm-payment` · `POST /orders/{id}/cancel` | customer | `POST /orders/payments/webhook` for Razorpay |
| Admin catalogue | `GET/POST /admin/products`, `GET/PATCH/DELETE /admin/products/{id}`, `POST …/deactivate`, `POST …/images|tryon-assets|models` (multipart `file` + `meta`), `GET/POST/PATCH /admin/categories`, `/admin/collections` (+`/hero-image`), `/admin/stores` | manager+ (delete: admin) | uploads are validated and re-encoded |
| Admin ops | `GET /admin/customers`, `GET/PATCH /admin/customers/{id}`, `POST /admin/staff`, `GET/PATCH /admin/orders[/{id}]`, `GET/PATCH /admin/enquiries[/{id}]`, `GET/PATCH /admin/appointments[/{id}]`, `GET /admin/looks`, `GET /admin/analytics/overview?days=` | staff (customer edit: manager+, staff create: admin) | |

Schemas: `backend/app/schemas/*.py` are the source of truth; the OpenAPI document is
generated from them.

## Versioning

Breaking changes get a new prefix (`/api/v2`). Additive changes (new optional fields) are
made in place.
