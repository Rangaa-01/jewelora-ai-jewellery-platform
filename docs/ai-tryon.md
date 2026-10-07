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
       → AffineCompositor.render (tint variant metal, warp, lighting match, occlusion, shadow)
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
