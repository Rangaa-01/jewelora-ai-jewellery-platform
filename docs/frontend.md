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

## 3D viewer

`src/components/viewer3d/` renders product GLB models with React Three Fiber + drei.

- **Lazy by design.** `JewelleryViewer` (client wrapper, chrome, states) imports the
  three.js scene (`jewellery-scene.tsx`) through `next/dynamic({ ssr: false })`. Nothing
  from three lands in a route's initial chunk; the product page shows photos until the
  customer presses "View in 3D" (`View3DButton` preloads the GLB on hover/focus/touch).
  The home "3D Jewellery Experience" section mounts the viewer only when scrolled near.
- **Framing.** Models are cloned, centred and normalised so their longest side is 2 units;
  camera presets (front / top / side), zoom limits and auto-rotate are therefore stable
  for any upload. Auto-rotate stops on first interaction and under reduced motion.
- **Material naming convention for uploaded GLBs.** Materials named `<anything>_metal`
  are replaced with a physically based metal (metalness 1, roughness ≈ 0.2, clearcoat) in
  the variant's colour; `<stone>_gem` (e.g. `diamond_gem`, `ruby_gem`, `pearl_gem`) get
  transmission/IOR/attenuation presets from `src/lib/viewer3d/materials.ts`
  (`GEM_PRESETS`). Any other material is left exactly as authored. Clear stones get a
  capped `Sparkles` layer sized to the gem bounding box.
- **Variants.** `pickModelForVariant` shows the variant's own GLB when one exists, else the
  primary model with `*_metal` re-tinted from the variant's `tint_hex`. The metal/stone
  switches list only combinations that exist as active product variants; selecting one
  calls `onVariantChange(variantId)`, which the product page feeds back into its variant
  selector (single source of truth: `ProductDetail`'s `variantId`).
- **Performance rules.** `frameloop="demand"` unless auto-rotating, `dpr` capped at 1.75,
  procedural `StudioEnvironment` (no HDR download, CSP friendly), `ContactShadows` with
  `frames={1}`, materials created by the viewer are disposed on change/unmount, sparkles
  and auto-rotate are disabled on low-end devices (`isLowEndDevice`: ≤ 4 cores or ≤ 2 GB)
  and when reduced motion is set. WebGL context loss shows a retry state.
- **States.** Loading (progress from `useProgress`), model load failure (friendly message,
  the slot falls back to photos and stops offering 3D), WebGL unsupported, no model.
- **Fullscreen.** Native Fullscreen API when available; a fixed overlay fallback (Escape
  closes) for iOS Safari. All chrome buttons are ≥ 44 px, labelled and keyboard reachable.

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

## Live try-on

Live mode (`src/components/tryon/live-tryon.tsx`, `src/lib/tryon/live/`) runs entirely
in the browser:

- **Camera**: `getUserMedia` (front camera by default, switch button). The selfie preview
  is mirrored with CSS; landmarks are converted into the *displayed* coordinate space
  (`x' = width − x`) so the engine's "image-left/right" region names match what the
  customer sees. MediaPipe reports handedness assuming a mirrored input, so the label is
  swapped for the unmirrored rear camera.
- **Detection**: `@mediapipe/tasks-vision` FaceLandmarker / HandLandmarker /
  PoseLandmarker in `VIDEO` mode. The WASM runtime loads from
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@<version>/wasm` and the `.task`
  models from same-origin `/models/`. Only the detectors the selected jewellery needs are
  created (`detectorsNeeded`). GPU delegate first, CPU fallback; "Low" quality forces CPU
  and a 640 px stream. Everything is dynamically imported on "Start camera" so nothing
  from MediaPipe ships in the route's initial chunk.
- **Smoothing**: one-euro filters per landmark coordinate (`smoothing.ts`) remove jitter
  while keeping latency low during movement; the loop is throttled to ~24 fps.
- **Fitting**: `src/lib/tryon/fitting/` is a port of the Python engine
  (`ai/jewelora_ai/fitting`). `parity.test.ts` replays `ai/tests/fixtures/*.landmarks.json`
  against `fitting_expectations.json` (generated by
  `scripts/export_fitting_fixtures.py`) and asserts anchors within 1e-6 px and matrices
  within 1e-9. Regenerate the expectations whenever the Python fitting changes.
- **Rendering**: a `<canvas>` over the `<video>`; each placement is drawn with
  `ctx.setTransform` from the 2×3 matrix. Variant metals are pre-tinted once per
  asset+variant in an offscreen canvas (`tint.ts`, same hue-remap as
  `compositor.tint_metal`; the server's 1 px mask blur is omitted).
- **Capture**: composites the mirrored frame + overlay to a JPEG and submits it through
  the normal photo try-on endpoint, so the server renders the authoritative result
  (lighting match, occlusion, shadow) that can be saved and shared.
- **States**: idle, starting, loading-models (with progress text), running, denied,
  no-camera, unsupported (no WebGL/WASM), models-failed; a non-blocking on-screen hint
  when the required face/hand/body isn't in frame. All tracks and landmarkers are closed
  on stop/unmount.

### Photo studio

`tryon-studio.tsx` composes `LookItemList` (variant + placement slot per piece),
`ResultPanel` (hold-to-compare before/after, warnings, ring-size estimate card,
fine-tuning sliders debounced into `POST /tryon/results/{id}/adjust`, "Try other pieces on
this photo" via `POST /tryon/photos/{id}/run`) and `useTryOnSession` (mutations; the
previous image stays visible while a new result loads).
