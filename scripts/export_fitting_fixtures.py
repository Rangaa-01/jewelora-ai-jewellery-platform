"""Export fitting expectations so the TypeScript port can be checked against Python.

For every recorded landmark fixture (ai/tests/fixtures/*.landmarks.json) this computes
anchors_for() for each jewellery type/slot and fit_asset() for a synthetic asset, writing
ai/tests/fixtures/fitting_expectations.json. The Vitest parity test in
frontend/src/lib/tryon/fitting/parity.test.ts asserts the TS implementation matches.

    backend/.venv/bin/python scripts/export_fitting_fixtures.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from jewelora_ai.datatypes import Adjustments, AssetSpec, JewelleryType, Point
from jewelora_ai.detectors.fixture_detector import landmarks_from_json
from jewelora_ai.fitting.anchors import AnchorError, anchors_for
from jewelora_ai.fitting.fitters import fit_asset

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "ai" / "tests" / "fixtures"

# Synthetic asset geometry per jewellery type (the bitmap content is irrelevant to fitting).
ASSETS: dict[str, dict[str, object]] = {
    "necklace": {
        "size": (1400, 1000),
        "anchors": {"left_end": (0.07, 0.06), "right_end": (0.93, 0.06), "bottom": (0.5, 0.76)},
        "real": (150.0, 107.14),
    },
    "choker": {
        "size": (1400, 1000),
        "anchors": {"left_end": (0.07, 0.06), "right_end": (0.93, 0.06)},
        "real": (125.0, 89.3),
    },
    "earrings": {"size": (500, 900), "anchors": {"top": (0.5, 0.139), "bottom": (0.5, 0.814)}, "real": (28.9, 52.0)},
    "ring": {
        "size": (800, 600),
        "anchors": {"center": (0.5, 0.69), "top": (0.5, 0.56), "band_left": (0.08, 0.62), "band_right": (0.92, 0.62)},
        "real": (20.0, 15.0),
    },
    "bangle": {
        "size": (900, 900),
        "anchors": {"center": (0.5, 0.5), "left": (0.04, 0.5), "right": (0.96, 0.5)},
        "real": (62.0, 62.0),
    },
    "nose_ring": {"size": (400, 400), "anchors": {"pivot": (0.248, 0.248), "center": (0.5, 0.5)}, "real": (12.0, 12.0)},
    "maang_tikka": {
        "size": (500, 900),
        "anchors": {"top": (0.5, 0.03), "bottom": (0.5, 0.96), "pendant_center": (0.5, 0.75)},
        "real": (36.0, 64.8),
    },
    "waist_chain": {
        "size": (1600, 700),
        "anchors": {"left_end": (0.04, 0.12), "right_end": (0.96, 0.12), "bottom": (0.5, 0.758)},
        "real": (320.0, 140.0),
    },
    "anklet": {
        "size": (1000, 500),
        "anchors": {"left_end": (0.05, 0.15), "right_end": (0.95, 0.15)},
        "real": (95.0, 47.5),
    },
    # earrings without physical size to exercise the oval-based fallback
    "earrings_nosize": {"size": (500, 900), "anchors": {"top": (0.5, 0.139)}, "real": None, "type": "earrings"},
}

CASES: list[tuple[str, str | None]] = [
    ("necklace", None),
    ("choker", None),
    ("earrings", None),
    ("earrings_nosize", None),
    ("nose_ring", None),
    ("nose_ring", "right_nostril"),
    ("maang_tikka", None),
    ("ring", None),
    ("ring", "left_index"),
    ("ring", "right_ring"),
    ("ring", "right_pinky"),
    ("bangle", None),
    ("bangle", "left_wrist"),
    ("waist_chain", None),
    ("anklet", None),
    ("anklet", "right_ankle"),
]
ADJUSTMENTS = [Adjustments(), Adjustments(offset_x=12.5, offset_y=-7.25, scale=1.3, rotation_deg=-8.0)]


def asset_for(key: str) -> AssetSpec:
    spec = ASSETS[key]
    w, h = spec["size"]  # type: ignore[misc]
    real = spec["real"]
    jtype = JewelleryType(str(spec.get("type", key)))
    return AssetSpec(
        image=np.zeros((h, w, 4), dtype=np.uint8),
        anchors={k: Point(*v) for k, v in spec["anchors"].items()},  # type: ignore[union-attr]
        jewellery_type=jtype,
        real_width_mm=real[0] if real else None,  # type: ignore[index]
        real_height_mm=real[1] if real else None,  # type: ignore[index]
        asset_id=key,
    )


def main() -> None:
    out: dict[str, object] = {"assets": {}, "fixtures": {}}
    for key, spec in ASSETS.items():
        w, h = spec["size"]  # type: ignore[misc]
        real = spec["real"]
        out["assets"][key] = {  # type: ignore[index]
            "width": w,
            "height": h,
            "anchors": spec["anchors"],
            "jewellery_type": str(spec.get("type", key)),
            "real_width_mm": real[0] if real else None,  # type: ignore[index]
            "real_height_mm": real[1] if real else None,  # type: ignore[index]
        }
    for path in sorted(FIXTURES.glob("*.landmarks.json")):
        name = path.name.replace(".landmarks.json", "")
        lm = landmarks_from_json(json.loads(path.read_text()))
        cases = []
        for asset_key, slot in CASES:
            asset = asset_for(asset_key)
            try:
                anchor_sets = anchors_for(lm, asset.jewellery_type, slot)
            except AnchorError as exc:
                cases.append({"asset": asset_key, "slot": slot, "error": str(exc).split(":")[0]})
                continue
            placements = []
            for anchors in anchor_sets:
                fits = [fit_asset(asset, anchors, lm.image_width, lm.image_height, adj) for adj in ADJUSTMENTS]
                placements.append(
                    {
                        "anchors": {
                            "region": anchors.region,
                            "points": {k: [p.x, p.y] for k, p in anchors.points.items()},
                            "px_per_mm": anchors.px_per_mm,
                            "rotation_deg": anchors.rotation_deg,
                            "confidence": anchors.confidence,
                            "mirror": anchors.mirror,
                        },
                        "fits": [
                            {
                                "adjustments": {
                                    "offset_x": adj.offset_x,
                                    "offset_y": adj.offset_y,
                                    "scale": adj.scale,
                                    "rotation_deg": adj.rotation_deg,
                                },
                                "matrix": [[float(v) for v in row] for row in fit.matrix],
                                "bbox": list(fit.bbox),
                            }
                            for adj, fit in zip(ADJUSTMENTS, fits, strict=True)
                        ],
                    }
                )
            cases.append({"asset": asset_key, "slot": slot, "placements": placements})
        out["fixtures"][name] = cases  # type: ignore[index]
    target = FIXTURES / "fitting_expectations.json"
    target.write_text(json.dumps(out, indent=1))
    total = sum(len(c) for c in out["fixtures"].values())  # type: ignore[attr-defined]
    print(f"wrote {target} ({total} cases)")


if __name__ == "__main__":
    main()
