# Security

Security controls and where they live.

| Threat | Control | Where |
|--------|---------|-------|
| SQL injection | SQLAlchemy parameterised queries only; no string SQL from input | `backend/app/services/*` |
| XSS | React escaping; strict CSP (`script-src 'self'`, no inline except Next runtime), `X-Content-Type-Options`, API never returns HTML | `frontend/next.config.ts`, `backend/app/core/middleware.py` |
| CSRF | `SameSite=Lax` HttpOnly cookies + required `X-Requested-With: jewelora` header on state-changing requests from cookie sessions; Razorpay webhook verified by HMAC instead | `CSRFHeaderMiddleware` |
| Auth bypass | Argon2id hashes, short-lived JWT access tokens, rotating refresh tokens with reuse detection (family revocation), token version bump on password change / deactivation, lockout after 8 failures | `app/core/security.py`, `app/services/auth_service.py` |
| Authorisation bypass | Role dependencies on every admin router; object-level ownership checks in services (looks, photos, results, orders, carts); customers can only read their own data; public share pages strip identity | `app/core/deps.py`, services |
| Malicious uploads | Size caps, MIME + magic-byte sniffing, full decode with decompression-bomb limits, re-encode (strips EXIF/metadata, neutralises polyglots), GLB container validation, randomised storage keys, no client path components | `app/services/upload_service.py`, `app/storage/base.py` |
| Path traversal | Storage keys validated (`..`, absolute, backslash rejected) and resolved under the root | `app/storage/local.py`, `app/api/v1/media.py` |
| Private data exposure | Customer photos/results under `private/` served only through HMAC-signed, expiring URLs; retention + customer deletion; staff notes never serialised to customers | storage, `tryon` router, cleanup task |
| API abuse | slowapi rate limits per user/IP (auth, OTP, uploads, AI, forms, search) | `app/core/rate_limit.py` |
| Secrets | Environment only; `.env*` gitignored; production refuses to boot with dev secret, dev DB password, insecure cookies or local storage | `Settings._refuse_insecure_production` |
| Payment tampering | Server computes totals from DB prices; Razorpay signature verified before marking paid; webhook signature verified | `app/integrations/payments.py` |
| Account enumeration | Identical error for unknown user/wrong password with timing equalisation; OTP request returns a neutral message | auth service |
| Transport | HSTS in production, nginx TLS termination, `Permissions-Policy` limits camera to same origin | middleware, `docker/nginx.conf` |

## Operational checklist

- Rotate `SECRET_KEY` only with a planned session reset (all tokens become invalid).
- Keep `COOKIE_SECURE=true`, serve over HTTPS, set `TRUSTED_HOSTS`.
- Use an S3 bucket with public read only on the `public/` prefix; `private/` must be private.
- Run `python -m app.cli cleanup` daily (photo retention).
- Review `admin_*` log events (structured audit trail of staff mutations).
- Dependencies: `npm audit`, `uv pip list --outdated` in CI cadence.

## Reporting

Security issues: contact the shop's engineering owner directly; do not open public issues.
