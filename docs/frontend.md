# Frontend guide

The customer site and admin dashboard live in `frontend/` (Next.js App Router, React 19,
TypeScript strict, Tailwind CSS v4).

## Structure

```
src/app/                 routes (server components by default; page.tsx reads params/searchParams as Promises)
  layout.tsx             fonts, metadata, skip link, Header/Footer, Providers
  error.tsx / global-error.tsx / not-found.tsx / loading.tsx
  manifest.ts            PWA manifest
src/components/
  ui/                    primitives: Button/ButtonLink, Input/Textarea/Select/Checkbox, Dialog/Sheet, Tabs,
                         Badge, Skeleton, Toast (useToast), EmptyState/ErrorState, Price, Container/Section
  motion/                Reveal, Parallax, MagneticButton, Sparkle, useReducedMotion
  layout/                Header, MobileNav, SearchDialog, Footer, Logo
  home/                  the 15 home-page sections
  catalogue/             ProductCard, ProductGrid, FilterPanel/FilterToolbar, Pagination, Catalogue
  product/               ProductDetail, ProductViewerSlot (3D viewer mounts here in Phase 5), selectors
  tryon/                 TryOnStudio (photo + camera capture), ProductPicker
  account/, appointments/, enquiry/, stylist/, visual-search/, looks/, forms/
src/lib/
  api/client.ts          fetch wrapper: same-origin /api/v1, JSON, CSRF header, ApiError with safe messages
  api/types.ts           mirrors backend Pydantic schemas (decimals are strings)
  api/hooks.ts           TanStack Query hooks (products, product, categories, collections, session, stores…)
  stores/                Zustand: ui-store (menus), shopper-store (device cart/wishlist/recently viewed, persisted)
  catalogue-params.ts    URL ⇄ filter parsing/serialisation
  format.ts, labels.ts, forms.ts, site.ts, utils.ts, hooks/use-hydrated.ts
src/content/             editable copy the shop owns (testimonials)
src/styles/tokens.css    design tokens
```

## Design tokens

Defined in `src/styles/tokens.css` and exposed to Tailwind through `@theme inline` in
`globals.css` (`bg-bg`, `text-fg-muted`, `text-accent-text`, `bg-gold`, `text-emerald`…).

| Token group | Values |
|-------------|--------|
| Surfaces | ivory `#faf7f2`, ivory-soft, paper, sand; dark theme `#121110` / `#1b1a17` |
| Ink | `#1b1a17`, soft, muted (≥ 4.5:1 on ivory), faint |
| Gold | `gold #c6a15b` (decorative), `gold-bright` (highlights), `gold-deep #8a6a2b` (text, AA on ivory), `gold-ink` |
| Secondary | emerald `#0f5c4a`, emerald-soft; rose-gold `#d9a68f` |
| Semantic | success, warning, danger, info |
| Type | display: Cormorant Garamond (`font-display`, h1–h3 by default); body: Manrope (`font-sans`) |
| Radius / shadow / motion | `--radius-*`, warm `--shadow-*`, `--shadow-gold`, `--ease-luxe`, `--dur-*` |

Dark mode: `prefers-color-scheme: dark` unless `data-theme="light"`; `data-theme="dark"` forces it.
Utilities: `container-x`, `eyebrow`, `gold-text`, `hairline`, `touch-target`, `.skeleton`.

## Conventions

- **Server vs client.** `page.tsx` files are server components that parse `params` /
  `searchParams` (Promises in Next 16) and hand validated props to a client component.
  Anything using hooks, TanStack Query, Zustand, Framer Motion, GSAP, R3F or MediaPipe is
  `"use client"`. Three.js/MediaPipe code is loaded with `dynamic(() => import(...), { ssr: false })`
  from inside a client component (never from a server component).
- **Data fetching.** Browser calls go through `src/lib/api/client.ts` to same-origin
  `/api/v1/*` (rewritten to FastAPI in `next.config.ts`). Mutations automatically send
  `X-Requested-With: jewelora` (CSRF). Errors become `ApiError` whose `message` is always
  safe to render; `FormError` maps 404s from not-yet-available services to an honest notice.
  Every query renders loading (Skeleton), empty (EmptyState) and error (ErrorState with retry).
- **Forms.** React Hook Form + Zod; backend field errors are copied onto fields via
  `applyApiFieldErrors`. Use `useWatch` instead of `watch` (React Compiler compatibility).
- **State.** Server state in TanStack Query; device state (cart, wishlist, recently viewed)
  in the persisted shopper store, gated with `useHydrated()` to avoid hydration mismatches.
  Derive state during render instead of `setState` inside effects (lint rule enforced).
- **Typed routes** are on: every `href` must be a real route, so dead links fail `tsc`.
- **Motion rules.** Decorative only; never gate content or buttons behind animation. All
  motion components check `useReducedMotion()`; Sparkle pauses offscreen/hidden; GSAP +
  ScrollTrigger are imported lazily where used. No blur on text.
- **Images.** `next/image` with `remotePatterns` (https anywhere, local hosts in dev). Use
  `preload` instead of the deprecated `priority`.
- **No new dependencies** were added in Phase 2 beyond the scaffold (`vite-tsconfig-paths`
  for Vitest path aliases).

## Accessibility checklist

- Semantic landmarks (`header`, `nav` with labels, `main#main`, `footer`), skip link.
- Visible focus rings (`:focus-visible` gold outline) on all interactive elements.
- Touch targets ≥ 44px (`touch-target`, `min-h-11`).
- Dialog/Sheet: native `<dialog>`, focus trap, Escape closes, focus returns to the opener,
  `aria-labelledby/describedby`.
- Tabs follow the WAI-ARIA pattern (roving tabindex, arrow keys, Home/End).
- Form fields: label association, `aria-invalid`, `aria-describedby` to hint/error, `role="alert"`.
- Toasts: `aria-live` region; errors use `role="alert"`.
- Contrast: body text and gold text use the deep variants (≥ 4.5:1); decorative gold only on
  large text or icons. Colour is never the only indicator (badges carry text).
- Reduced motion honoured globally (CSS) and in JS.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run build   # inside frontend/
npm run test:e2e                                                # repo root (Playwright)
```
