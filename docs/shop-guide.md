# Shop guide — adding your jewellery

This is for the shop team, not developers. Everything happens in the admin dashboard at
`/admin` (sign in with a staff account; the owner's admin account is created with
`python -m app.cli create-admin --email … --password …`).

## 1. Photograph each piece

For the best try-on and catalogue results, per piece:

- **One front-view photo** on a plain, evenly lit background (white, grey or black). No hands,
  stands, boxes or props touching the piece. This photo becomes both the catalogue image
  and the try-on cut-out.
- Optional extra angles (side, back, worn) for the gallery.
- Optional **3D model** (`.glb`) if you have CAD or a scan — this enables the 360° viewer.
- Know the **real width in millimetres** (e.g. a bangle's outer diameter, a necklace's width
  at the top ends). It makes the piece the right size on the customer.

**Backdrop for try-on photos.** Use a light grey or white backdrop for the try-on photo. On black velvet, dark stones (sapphire, amethyst, garnet) and the velvet are the same colour, so the cut-out either keeps velvet patches or loses stones. The quality score flags this as "Backdrop inside the piece". Dark backgrounds are still fine for catalogue photos.

Camera guidance for try-on cut-outs: shoot straight on, centred, with the whole piece in
frame. Rings: from above with the stone facing the camera. Earrings: one earring hanging
freely. Necklaces, harams, chokers: laid flat in their natural curve.

## 2. Create the product

Admin → **Products** → **New product**:

| Field | What to enter |
|-------|---------------|
| SKU, name, category | Your internal code; a customer-facing name; the category drives filters |
| Jewellery type | Controls how the try-on places it (necklace, earrings, ring, bangle, …) |
| Metal, purity, stone | Shown to customers and used by the AI stylist |
| Weights, making charges, price, discount | Price is the selling price; weights appear on the detail page |
| Stock / made to order | Stock blocks checkout when 0 unless "made to order" |
| Occasions, tags, style, gender | Used by search and the stylist ("wedding", "festive", "everyday", …) |
| Sizes | Lengths (16", 18"), ring sizes, bangle sizes — with optional price differences |
| Variants | Only the metal/stone combinations you actually offer (each may have its own stock and price difference) |
| Collections | Curated groups shown on the home page and `/collections` |

Save, then open the **Assets** tab.

## 3. Upload assets

1. **Images** — drag in the product photos; mark one as primary. Images are resized and
   optimised automatically and indexed for visual search.
2. **Try-on cut-out** — upload the front-view photo and tick **Auto cut-out from a normal
   product photo**. The system removes the background and estimates the anchor points.
   Two options help with tricky photos: **Keep only the largest piece** (a pair of earrings,
   a loose stone beside a ring) and **Re-open holes filled with backdrop** (the inside of a
   ring or the loop of a chain photographed on fabric). Leave it off when dark stones sit on a dark backdrop: they would be cut out with it.
   Check the anchors in the preview (click to move them), enter the real width in mm, and
   upload. If you already have a transparent PNG from your photographer, upload it directly
   and place the anchors yourself.
3. **3D model** — upload a `.glb` (optional). Name materials `*_metal` and `*_gem` so the
   viewer applies realistic metal and gem shading and metal switching.

**Asset quality.** The product's Details tab shows a quality score with a checklist and the
fix for each item:

- Photos: resolution, sharpness, lighting, background and extra angles.
- Try-on cut-out: transparency, anchor points, detail, real size and cleanliness.
- Optional 3D model.

"Try-on ready" means customers see the Try It On button. Image views now include **detail /
close-up** and **on model**, for the shop's own photos of a person wearing the piece.

The product is live immediately when **Active** is on. "Try it on" appears once a cut-out
exists; "View in 3D" once a model exists.

## 4. Bulk import (many pieces at once)

Prepare a folder of photos and a CSV (one row per product) and run:

```bash
cd backend
.venv/bin/python -m app.cli import-products --csv /path/to/products.csv --photos /path/to/photos
```

CSV columns: `sku,name,category_slug,jewellery_type,metal_type,purity,stone_type,base_price,stock_quantity,gross_weight_g,net_weight_g,making_charges,occasions,tags,style,gender,photo,real_width_mm,collections,short_description`
(`occasions`, `tags`, `collections` are `|`-separated; `photo` is the file name in the photos
folder). A template is in `database/seeds/import-template.csv`. Rows with an existing SKU
are updated.

## 5. Collections, categories, stores

Admin → Collections: name, tagline, hero image, assign products. Without a hero image the
card shows a mosaic of its products. Categories and stores (address, hours, appointment
slot length) are managed the same way.

## 6. What customers see

Catalogue → product page (photos, 3D if provided, sizes, variants) → **Try it on** (photo or
live camera) → wishlist, save/share look, enquire, book a visit, add to bag, checkout.
Enquiries, appointments and orders arrive in the admin queues; the dashboard shows what is
being tried, viewed, wishlisted and bought.
