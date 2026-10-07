"""Visual smoke test for the try-on engine.

Runs detection + fitting + rendering on the CC0 fixture photos with the generated seed
assets and writes composites (and optional crops) to an output folder for inspection.

    backend/.venv/bin/python scripts/tryon_smoke.py --out /tmp/tryon
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.dev_assets import render2d  # noqa: E402

GEN = ROOT / "database" / "seeds" / ".generated"
FIX = ROOT / "ai" / "tests" / "fixtures"

CASES: dict[str, list[tuple[str, str, str | None, str | None, str | None]]] = {
    # fixture: [(jewellery_type, style, gem, metal, slot)]
    "portrait_front.jpg": [
        ("necklace", "necklace", "ruby", "gold", None),
        ("earrings", "jhumka", "ruby", "gold", None),
        ("maang_tikka", None, "kundan", "gold", None),
        ("nose_ring", None, "diamond", "gold", None),
    ],
    "portrait_ears.jpg": [
        ("earrings", "drop", "emerald", "gold", None),
        ("choker", "choker", "pearl", "gold", None),
        ("maang_tikka", None, "kundan", "gold", None),
    ],
    "hands_flowers.jpg": [
        ("ring", "solitaire", "diamond", "white_gold", "right_ring"),
        ("bangle", "bangle", "none", "gold", "right_wrist"),
    ],
    "hand_single.jpg": [("ring", "halo", "ruby", "gold", None), ("bracelet", "bracelet", "diamond", "rose_gold", None)],
    "fullbody.jpg": [("waist_chain", None, "ruby", "gold", None), ("anklet", None, "none", "silver", None)],
}
CROPS = {
    "portrait_front.jpg": (330, 60, 650, 420),
    "portrait_ears.jpg": (150, 100, 900, 900),
    "hands_flowers.jpg": (420, 120, 900, 599),
}


def load_asset(jtype: str, style: str | None, gem: str, metal: str):  # type: ignore[no-untyped-def]
    from jewelora_ai.datatypes import AssetSpec, JewelleryType, Point

    key = f"{jtype}-{style or 'default'}-{metal}-{gem}"
    png, meta_path = GEN / f"{key}.png", GEN / f"{key}.json"
    if not png.exists():
        renderer = render2d.RENDERERS[jtype]
        result = renderer(metal, gem, style=style) if style else renderer(metal, gem)
        GEN.mkdir(parents=True, exist_ok=True)
        result.image.save(png)
        meta_path.write_text(
            json.dumps(
                {
                    "anchors": result.anchors,
                    "real_width_mm": result.real_width_mm,
                    "real_height_mm": result.real_height_mm,
                }
            )
        )
    meta = json.loads(meta_path.read_text())
    import numpy as np

    image = np.asarray(Image.open(png).convert("RGBA"))
    return AssetSpec(
        image=image,
        anchors={k: Point(*v) for k, v in meta["anchors"].items()},
        jewellery_type=JewelleryType(jtype),
        real_width_mm=meta["real_width_mm"],
        real_height_mm=meta["real_height_mm"],
        asset_id=key,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="/tmp/tryon-smoke")
    parser.add_argument(
        "--fixture-landmarks", action="store_true", help="replay cached landmarks instead of running MediaPipe"
    )
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    from jewelora_ai.datatypes import TryOnItem, TryOnRequest
    from jewelora_ai.detectors.fixture_detector import landmarks_from_json, landmarks_to_json
    from jewelora_ai.detectors.mediapipe_detector import MediaPipeLandmarkDetector
    from jewelora_ai.engine import TryOnEngine, TryOnError
    from jewelora_ai.preprocessing import load_rgb
    from jewelora_ai.segmentation.mediapipe_segmenter import MediaPipeSegmenter

    engine = TryOnEngine(detector=MediaPipeLandmarkDetector(), segmenter=MediaPipeSegmenter())
    for fname, items in CASES.items():
        pre = load_rgb((FIX / fname).read_bytes(), max_dimension=1200)
        lm_path = FIX / (fname.rsplit(".", 1)[0] + ".landmarks.json")
        if args.fixture_landmarks and lm_path.exists():
            lm = landmarks_from_json(json.loads(lm_path.read_text()))
        else:
            lm = engine.detect(pre.rgb)
            lm_path.write_text(json.dumps(landmarks_to_json(lm)))
        request = TryOnRequest(
            image=pre.rgb,
            items=[TryOnItem(asset=load_asset(j, s, g, m), slot=slot) for j, s, g, m, slot in items],
            landmarks=lm,
        )
        started = time.perf_counter()
        try:
            result = engine.run(request)
        except TryOnError as exc:
            print(f"{fname}: FAILED {exc.code}: {exc.message}")
            continue
        elapsed = time.perf_counter() - started
        composite = Image.fromarray(result.image)
        composite.save(out / fname.replace(".jpg", "_tryon.jpg"), quality=92)
        if fname in CROPS:
            crop = composite.crop(CROPS[fname])
            crop.resize((crop.width * 2, crop.height * 2)).save(out / fname.replace(".jpg", "_crop.jpg"), quality=92)
        ring = result.ring_size_estimate
        print(
            f"{fname}: placed={[p.region for p in result.placements]} confidence={result.confidence:.2f} "
            f"warnings={result.warnings} ring_size={ring and (ring['indian_size'], ring['width_mm'], ring['confidence'])} {elapsed:.2f}s"
        )


if __name__ == "__main__":
    main()
