# AI virtual try-on

Jewelora's try-on is a deterministic computer-vision pipeline built on MediaPipe Tasks.
Nothing is faked: every result is produced from detected landmarks and the product's
real try-on asset. Where a learned model is **not** yet integrated (generative
refinement), the boundary is explicit and documented below.

## Two modes

| Mode | Where it runs | What it uses |
|------|---------------|--------------|
| Photo try-on | Backend (`jewelora_ai`, Python) | Face / hand / pose landmarkers, selfie segmentation, affine compositor |
| Live try-on | Browser (`frontend/src/lib/tryon`) | Same MediaPipe models via `@mediapipe/tasks-vision` (WASM/WebGL), same fitting maths ported to TypeScript, canvas overlay |

Live video never leaves the device. Only a frame the customer explicitly saves is
uploaded, through the same validated photo path.

## Pipeline (photo mode)

```
upload → process_image (validate, orient, strip metadata, resize ≤ TRYON_MAX_DIMENSION)
       → store privately (private/customers/<owner>/photos/…)
       → MediaPipeLandmarkDetector.detect  (cached per photo in customer_photos.landmarks)
       → anchors_for(jewellery_type, slot)  (jewelora_ai/fitting/anchors.py)
       → fit_asset(asset, anchors, adjustments) → Placement (2×3 affine)
         or, for strand pieces, strand_placement(…) → Placement with 28 strip affines
       → MediaPipeSegmenter (hair/skin/clothes masks; only when a placement needs occlusion)
       → photo checks (analysis/photo_quality.py → photo_tips)
       → AffineCompositor.render_layers (tint, defringe, warp, relight, focus + grain match,
         occlusion, body shadow) at the chosen quality level
       → [premium] optional guarded generative refinement (refinement/)
       → encode WebP → store privately → tryon_results row (+ analytics event, tryon_count)
```

Entry points: `backend/app/api/v1/tryon.py` → `TryOnService` → `jewelora_ai.engine.TryOnEngine`.

### Anchors by jewellery type

| Type | Landmarks | Notes |
|------|-----------|-------|
| necklace, chain, pendant, haram, choker | face chin (152) + pose shoulders (11/12) | Falls back to face proportions when shoulders are implausible (off-image, above chin, wrong width) |
| earrings | face oval/lobe (234/177 image-left, 454/401 image-right), eye corners for roll | Hidden ear (head yaw) is skipped; visible ear is pushed outward proportionally to the turn |
| nose_ring | nostril (98 / 327) | slot `left_nostril` (default) / `right_nostril` |
| maang_tikka | hairline (10), forehead (151), brow mid (9) | chain runs up into the hair |
| ring | hand MCP/PIP of the chosen finger (index 5/6, middle 9/10, ring 13/14, pinky 17/18) | slot `right_ring`, `left_index`, … band spans the finger width |
| bangle, bracelet | wrist (0) + middle MCP (9) | slot `left_wrist` / `right_wrist` |
| waist_chain | pose hips (23/24) | needs a standing photo |
| anklet | pose ankle/knee (27/25, 28/26) | slot `left_ankle` / `right_ankle` |

Scale uses physical size when the asset declares `real_width_mm`/`real_height_mm`
(converted with average anthropometrics: 90 mm outer-eye distance, 76 mm palm width,
380 mm shoulder width; yaw-corrected) blended 50/50 with the anchor-pair fit, except
rings/bangles which always fit the detected body part.

### Photographic integration (why it doesn't look pasted)

`rendering/realism.py` measures the customer's photo once and adapts every piece to it.
Only jewellery pixels and the soft shadow they cast change; the face, skin and hair never do.

| Cue | How it is measured | What happens to the piece |
|-----|-------------------|---------------------------|
| Colour temperature | skin chromaticity vs. a neutral skin reference (grey-world fallback) | per-channel cast at 35 % strength, luminance-neutral |
| Exposure | mean luminance of the skin | mid-tones darkened in dim photos, never brightened past the studio shot; specular highlights kept |
| Light direction | least-squares luminance plane over lit skin | ±14 % shading across the piece; the shadow falls away from the light |
| Focus | Laplacian variance around the placement vs. the cut-out | small Gaussian (≤0.65 px) when the photo is softer; thin chains keep their opacity |
| Sensor noise | Immerkær's estimator on the whole photo | matching luma and chroma grain (deterministic seed) |
| Studio fringe | semi-transparent edge pixels | replaced by nearby solid colour (no white or black halo) |
| Contact | segmentation (skin, clothes, hair) | shadow plus faint ambient occlusion only on the body, never on the background |
| Black-and-white photo or sketch | average channel spread | colour muted to match, a hint kept so stones stay recognisable |
| Necklace ends | asset anchors | the top ends fade so the chain wraps around the neck |
| Earrings on a turned head | face yaw | horizontal foreshortening (`BodyAnchors.squash_x`, also in the TS port) |

### Quality levels

| Level | Render size | Pipeline | Use |
|-------|-------------|----------|-----|
| `fast` | 1024 px | geometry, occlusion, brightness, simple shadow | comparing pieces quickly |
| `standard` | 1600 px | full photographic integration | the default result |
| `premium` | 2400 px (photos are stored at this size) | standard + optional generative refinement, WebP q95 | save, share, download (`POST /tryon/results/{id}/premium`) |

Landmarks are detected once per photo at standard size and rescaled (`Landmarks.scaled_to`).

### Photo checks

`analysis/photo_quality.py` returns non-blocking tips with every result (`photo_tips`) and
in the error details of a failed try-on: low resolution, subject too far, head turned (earrings
only), soft focus, too dark or bright, neckline cropped (necklaces), hand too far (rings).

### Generative refinement (optional, guarded)

`refinement/` defines `RefinementProvider`. `NoRefinement` is the default, and
`/tryon/capabilities` reports `refinement: false`. The UI then says HD results are
"rendered at full resolution" and never claims refinement. To enable it, run any
inpainting/image-to-image service behind the HTTP contract in `HttpRefinement` and set
`REFINEMENT_PROVIDER=http`, `REFINEMENT_URL`, `REFINEMENT_TOKEN`. Whatever the model returns, `apply_guards` enforces:

* **Identity:** outside a thin band around the jewellery, pixels come from the deterministic
  render, which is the customer's photo plus the piece.
* **Product fidelity:** inside the piece's solid body, pixels come from the shop's
  photograph, so the model cannot redraw stones, count, colour or shape.

The model only touches the edge and contact band. If it fails, the deterministic HD render
is returned and `refined` stays false.

### Strand warp (neck pieces, waist chains, anklets)

A necklace is not a rigid sticker: its two ends sit on the neck base and the rest hangs in
a curve that depends on the piece's length. `fitting/strand.py` therefore:

1. reads the asset's own arc: a parabola through its `left_end`, `bottom` (or the lowest
   point) and `right_end` anchors;
2. builds the target arc on the body: the chord between the two neck-base points (tilted
   with the shoulders), and a hang depth taken from the asset's own depth scaled by the
   chord, then multiplied by `selected length ÷ default length for the type` (clamped
   0.6–1.8; defaults: choker 380 mm, necklace/pendant 457, chain 508, haram 711, waist
   chain 820, anklet 254). The length comes from the chosen size's `measurement_mm`, or
   the product's default size;
3. slices the asset into 28 vertical strips and maps each strip from a point on the
   source parabola to the matching point on the target parabola with a uniform-scale
   similarity (rotation follows the local tangent), so proportions are never squashed;
4. clips everything above the chord between the two ends (`chord_clip_row`): that is the
   back of the loop, which goes behind the neck.

Manual adjustments move/scale/rotate the whole target arc about its midpoint. The
compositor warps strip by strip with a 2 px overlap (`_warp_strips`), then applies the
usual tint, lighting, hair occlusion and shadow. The TypeScript port
(`frontend/src/lib/tryon/fitting/strand.ts`) is covered by the parity test, so live mode
drapes exactly like photo mode.

### Try-on assets (what the shop uploads)

A transparent PNG/WebP cut-out of the piece, front view, plus anchors in normalised
0–1 asset coordinates (admin → product → try-on assets):

| Type | Required anchors |
|------|------------------|
| neck pieces, waist chain, anklet | `left_end`, `right_end` (the two top ends of the strand); optional `bottom` |
| earrings | `top` (hook point); single earring, mirrored for the other ear |
| ring | `band_left`, `band_right` (finger edges), optional `top` (stone) — view from the back of the hand, far half of the band omitted |
| bangle, bracelet | `left`, `right` (outer edges, top-down view) |
| nose_ring | `pivot` (nostril contact point) |
| maang_tikka | `top` (into the hair), `pendant_center` |

`real_width_mm` / `real_height_mm` improve scale. Variant assets: upload one asset per
metal variant; otherwise `tint_hex` on the variant recolours the metal (gems untouched).

### Automatic cut-outs from ordinary product photos

Staff do not need to prepare transparent PNGs. In the admin asset manager, tick
**Auto cut-out from a normal product photo** (API: `auto_cutout=true` on
`POST /admin/products/{id}/tryon-assets`). The server removes the background with U²-Net
(`rembg`, model `ai/models/u2net.onnx`), keeps the main piece (a single earring from a pair),
trims the image and estimates the anchors from the outline
(`backend/app/services/cutout_service.py`). Anchors placed by staff override the estimates;
the physical size defaults per type and should be corrected to the real measurement.
Best input: front view, plain background, even light, no props. The seven real-photo demo
products in `database/seeds/photos/` were produced this way.

### Manual adjustments

`POST /api/v1/tryon/results/{id}/adjust` with `{ "<product_id>": { offset_x, offset_y, scale, rotation_deg } }`
re-renders using the cached landmarks (no re-detection), returning a new result.

### Ring size estimate

`jewelora_ai/fitting/ring_size.py` converts MediaPipe metric world landmarks (knuckle
spacing) to a finger width, then to circumference and Indian/US sizes. Every response
carries `is_estimate: true` and a note to confirm in store. `WORLD_SPACING_TO_FINGER_WIDTH`
is a calibration constant the shop should validate against measured customers.

## Browser port

`frontend/src/lib/tryon/fitting/{anchors,fitters,strand,types}.ts` mirror `anchors.py`,
`fitters.py` and `strand.py` so live mode places jewellery exactly as photo mode does. Parity is enforced
by `frontend/src/lib/tryon/fitting/parity.test.ts` against
`ai/tests/fixtures/fitting_expectations.json`; regenerate it after any fitting change:

```bash
backend/.venv/bin/python scripts/export_fitting_fixtures.py
```

Live mode fits in the raw frame's pixel space (never mirrored, like an uploaded photo) and
mirrors only the drawn overlay for the selfie preview. See `docs/frontend.md` → "Live
try-on".

## Models

Downloaded by `scripts/download_models.sh` into `ai/models/` (backend) and copied to
`frontend/public/models/` (browser). See `ai/models/README.md`. `AI_MODELS_DIR` overrides
the backend path. When models are missing the API returns `503 tryon_unavailable` and the
capabilities endpoint reports `photo_tryon: false`.

## Replacing a stage

All stages are `Protocol`s in `ai/jewelora_ai/interfaces.py`:

- `LandmarkDetector.detect(image) -> Landmarks`
- `Segmenter.segment(image) -> SegmentationMasks`
- `Renderer.render(image, [(item, placement)], masks) -> image`

Construct `TryOnEngine(detector=…, segmenter=…, renderer=…)` in
`backend/app/services/tryon_service.py::EngineRuntime.engine`. Tests use
`FixtureLandmarkDetector` (replays `ai/tests/fixtures/*.landmarks.json`) so fitting and
rendering are tested without MediaPipe; MediaPipe smoke tests skip when models are absent.

## Integration boundary: generative refinement

Not integrated. The contract and the recommended approach (draft composite → masked
image-to-image refinement conditioned on the draft, preserving identity/skin/hair/
clothing/background) are in `ai/jewelora_ai/rendering/README.md`. Bump
`ENGINE_VERSION` when adding one.

## Visual smoke test

```bash
backend/.venv/bin/python scripts/tryon_smoke.py --out /tmp/tryon
```

renders the CC0 fixture photos with the generated seed assets for eyeballing.

## Privacy

Customer photos and results live under `private/` keys, are only reachable through
short-lived signed URLs, expire after `CUSTOMER_PHOTO_RETENTION_DAYS`, and can be deleted
by the customer (`DELETE /api/v1/tryon/photos/{id}`), which also removes derived results.
