"""Procedural 2D jewellery renderer for development seed data.

Draws transparent jewellery assets (necklaces, earrings, rings, bangles, ...) with a
painterly gold material and faceted gems, plus the anchor metadata the try-on engine
needs. Everything is synthetic: these are stand-ins for the shop's real photography and
cut-outs and are never used in production.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SUPERSAMPLE = 2

METALS: dict[str, tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]] = {
    # (highlight, base, shadow)
    "gold": ((255, 241, 196), (214, 168, 74), (120, 84, 24)),
    "rose_gold": ((255, 226, 214), (214, 150, 120), (128, 70, 50)),
    "white_gold": ((255, 255, 255), (214, 214, 220), (110, 112, 125)),
    "platinum": ((250, 250, 252), (200, 203, 212), (100, 104, 118)),
    "silver": ((255, 255, 255), (205, 208, 215), (105, 108, 120)),
}

GEMS: dict[str, tuple[tuple[int, int, int], tuple[int, int, int]]] = {
    # (light, dark)
    "diamond": ((255, 255, 255), (190, 205, 230)),
    "ruby": ((255, 120, 140), (120, 10, 30)),
    "emerald": ((120, 230, 170), (10, 90, 50)),
    "sapphire": ((120, 160, 255), (15, 35, 120)),
    "pearl": ((255, 252, 245), (210, 200, 190)),
    "polki": ((255, 250, 235), (170, 150, 110)),
    "kundan": ((255, 245, 215), (180, 140, 60)),
    "cz": ((255, 255, 255), (200, 210, 230)),
    "none": ((255, 245, 215), (180, 140, 60)),
}


@dataclass
class RenderResult:
    image: Image.Image
    anchors: dict[str, list[float]]
    real_width_mm: float
    real_height_mm: float
    extras: dict[str, float] = field(default_factory=dict)


# --- material helpers -----------------------------------------------------------------------------


def _gradient(size: tuple[int, int], colors: tuple[tuple[int, int, int], ...], angle_deg: float = 60.0) -> Image.Image:
    w, h = size
    base = Image.new("RGB", (1, 256))
    px = base.load()
    assert px is not None
    n = len(colors) - 1
    for i in range(256):
        t = i / 255 * n
        k = min(int(t), n - 1)
        f = t - k
        c0, c1 = colors[k], colors[k + 1]
        px[0, i] = tuple(int(c0[j] + (c1[j] - c0[j]) * f) for j in range(3))
    grad = base.resize((max(w, h) * 2, max(w, h) * 2), Image.Resampling.BILINEAR).rotate(angle_deg, expand=False)
    left = (grad.width - w) // 2
    top = (grad.height - h) // 2
    return grad.crop((left, top, left + w, top + h))


def metal_fill(mask: Image.Image, metal: str) -> Image.Image:
    """Return an RGBA image where ``mask`` is filled with a brushed metal gradient."""
    hi, base, lo = METALS.get(metal, METALS["gold"])
    grad = _gradient(mask.size, (lo, base, hi, base, lo, hi, base), angle_deg=55)
    # Edge darkening gives depth.
    inner = mask.filter(ImageFilter.MinFilter(7))
    edge = ImageChops.subtract(mask, inner)
    shade = Image.new("RGB", mask.size, lo)
    grad = Image.composite(shade, grad, edge.point(lambda v: int(v * 0.55)))
    # Specular highlight band.
    spec = Image.new("L", mask.size, 0)
    sd = ImageDraw.Draw(spec)
    w, h = mask.size
    sd.polygon([(w * 0.1, 0), (w * 0.35, 0), (w * 0.75, h), (w * 0.5, h)], fill=90)
    spec = spec.filter(ImageFilter.GaussianBlur(w * 0.04))
    spec = ImageChops.multiply(spec, mask)
    highlight = Image.new("RGB", mask.size, hi)
    grad = Image.composite(highlight, grad, spec)
    out = grad.convert("RGBA")
    out.putalpha(mask)
    return out


def gem(draw_size: int, kind: str) -> Image.Image:
    """A round faceted gem as an RGBA sprite."""
    s = draw_size
    light, dark = GEMS.get(kind, GEMS["diamond"])
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = s / 2
    r = s * 0.48
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dark + (255,))
    # facets
    facets = 8
    for i in range(facets):
        a0 = 2 * math.pi * i / facets
        a1 = 2 * math.pi * (i + 1) / facets
        t = 0.55 + 0.45 * math.cos(a0 + 0.8)
        col = tuple(int(dark[j] + (light[j] - dark[j]) * t) for j in range(3)) + (255,)
        d.polygon(
            [(cx, cy), (cx + r * math.cos(a0), cy + r * math.sin(a0)), (cx + r * math.cos(a1), cy + r * math.sin(a1))],
            fill=col,
        )
    table = r * 0.55
    d.ellipse(
        (cx - table, cy - table, cx + table, cy + table),
        fill=tuple(int(dark[j] * 0.35 + light[j] * 0.65) for j in range(3)) + (255,),
    )
    # sparkle
    d.ellipse((cx - r * 0.42, cy - r * 0.5, cx - r * 0.1, cy - r * 0.18), fill=(255, 255, 255, 230))
    d.ellipse((cx + r * 0.15, cy + r * 0.2, cx + r * 0.3, cy + r * 0.35), fill=(255, 255, 255, 160))
    return img


def _finish(
    canvas: Image.Image, mask: Image.Image, metal: str, overlays: list[tuple[Image.Image, tuple[int, int]]]
) -> Image.Image:
    metal_layer = metal_fill(mask, metal)
    canvas.alpha_composite(metal_layer)
    for sprite, pos in overlays:
        canvas.alpha_composite(sprite, pos)
    # soft inner shadow for depth
    return canvas.resize((canvas.width // SUPERSAMPLE, canvas.height // SUPERSAMPLE), Image.Resampling.LANCZOS)


def _canvas(w: int, h: int) -> tuple[Image.Image, Image.Image, ImageDraw.ImageDraw]:
    W, H = w * SUPERSAMPLE, h * SUPERSAMPLE
    return Image.new("RGBA", (W, H), (0, 0, 0, 0)), Image.new("L", (W, H), 0), ImageDraw.Draw(Image.new("L", (W, H), 0))


# --- shapes ----------------------------------------------------------------------------------------


def _curve_points(
    w: float, h: float, depth: float, n: int, x0: float, x1: float, y_top: float
) -> list[tuple[float, float]]:
    """A smooth U-curve (cosine) from (x0, y_top) to (x1, y_top) with the given depth."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y_top + depth * math.sin(math.pi * t) ** 0.8
        pts.append((x, y))
    return pts


def render_necklace(
    metal: str = "gold",
    gem_kind: str = "ruby",
    *,
    style: str = "necklace",
    size: tuple[int, int] = (1400, 1000),
) -> RenderResult:
    """Necklace / choker / haram / chain with optional pendant, viewed from the front."""
    if style == "haram" and size == (1400, 1000):
        size = (1400, 1300)
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    depth_ratio = {"choker": 0.22, "necklace": 0.5, "haram": 0.6, "chain": 0.55, "pendant": 0.55}[style]
    y_top = h * S * 0.06
    x0, x1 = w * S * 0.07, w * S * 0.93
    depth = h * S * depth_ratio
    pts = _curve_points(w, h, depth, 120, x0, x1, y_top)
    overlays: list[tuple[Image.Image, tuple[int, int]]] = []
    thickness = {"choker": 0.055, "necklace": 0.045, "haram": 0.04, "chain": 0.012, "pendant": 0.01}[style] * h * S
    if style in ("chain", "pendant"):
        # fine link chain: alternating small ellipses
        for i in range(0, len(pts) - 1):
            x, y = pts[i]
            r = thickness
            md.ellipse((x - r, y - r * 0.6, x + r, y + r * 0.6), fill=255)
            md.ellipse((x - r * 0.6, y - r, x + r * 0.6, y + r), fill=180)
        md.line(pts, fill=255, width=int(thickness * 0.9), joint="curve")
    else:
        md.line(pts, fill=255, width=int(thickness), joint="curve")
        # beads / motifs along the curve
        n_beads = {"choker": 26, "necklace": 23, "haram": 31}[style]
        for i in range(1, n_beads):
            t = i / n_beads
            idx = int(t * (len(pts) - 1))
            x, y = pts[idx]
            scale = 0.7 + 0.6 * math.sin(math.pi * t) ** 1.5
            r = thickness * 0.95 * scale
            md.ellipse((x - r, y - r, x + r, y + r), fill=255)
            if style != "chain" and i % 2 == 0:
                g = gem(int(r * 1.1), gem_kind)
                overlays.append((g, (int(x - g.width / 2), int(y - g.height / 2))))
            # small drops below the main strand
            if style in ("necklace", "haram") and 0.2 < t < 0.8 and i % 2 == 1:
                dy = r * 1.9
                md.ellipse((x - r * 0.45, y + dy - r * 0.9, x + r * 0.45, y + dy + r * 0.9), fill=255)
    # pendant
    bottom_x, bottom_y = pts[len(pts) // 2]
    if style in ("pendant", "necklace", "haram"):
        pw = h * S * (0.16 if style != "pendant" else 0.2)
        ph = pw * 1.25
        px, py = bottom_x, bottom_y + ph * 0.45
        md.polygon([(px, py - ph * 0.55), (px + pw * 0.5, py), (px, py + ph * 0.55), (px - pw * 0.5, py)], fill=255)
        md.ellipse((px - pw * 0.42, py - ph * 0.42, px + pw * 0.42, py + ph * 0.42), fill=255)
        g = gem(int(pw * 0.62), gem_kind)
        overlays.append((g, (int(px - g.width / 2), int(py - g.height / 2))))
        small = gem(int(pw * 0.14), "diamond")
        for k in range(10):
            a = 2 * math.pi * k / 10
            overlays.append(
                (
                    small,
                    (
                        int(px + pw * 0.37 * math.cos(a) - small.width / 2),
                        int(py + ph * 0.37 * math.sin(a) - small.height / 2),
                    ),
                )
            )
        bottom_y = py + ph * 0.55
    image = _finish(canvas, mask, metal, overlays)
    real_width = {"choker": 125.0, "necklace": 150.0, "haram": 160.0, "chain": 140.0, "pendant": 140.0}[style]
    return RenderResult(
        image=image,
        anchors={
            "left_end": [x0 / (w * S), y_top / (h * S)],
            "right_end": [x1 / (w * S), y_top / (h * S)],
            "bottom": [bottom_x / (w * S), bottom_y / (h * S)],
        },
        real_width_mm=real_width,
        real_height_mm=real_width * h / w,
    )


def render_earring(
    metal: str = "gold", gem_kind: str = "emerald", *, style: str = "jhumka", size: tuple[int, int] = (500, 900)
) -> RenderResult:
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    overlays: list[tuple[Image.Image, tuple[int, int]]] = []
    cx = w * S / 2
    top_y = h * S * 0.05
    # hook / stud
    stud_r = w * S * 0.16
    md.ellipse((cx - stud_r, top_y, cx + stud_r, top_y + 2 * stud_r), fill=255)
    g = gem(int(stud_r * 1.3), gem_kind)
    overlays.append((g, (int(cx - g.width / 2), int(top_y + stud_r - g.height / 2))))
    y = top_y + 2 * stud_r
    if style == "jhumka":
        md.line([(cx, y), (cx, y + h * S * 0.08)], fill=255, width=int(w * S * 0.04))
        y += h * S * 0.08
        bell_w = w * S * 0.42
        bell_h = h * S * 0.3
        md.polygon([(cx, y), (cx + bell_w, y + bell_h), (cx - bell_w, y + bell_h)], fill=255)
        md.chord((cx - bell_w, y + bell_h - bell_w * 0.5, cx + bell_w, y + bell_h + bell_w * 0.5), 0, 180, fill=255)
        # dangling beads along the rim
        for k in range(9):
            t = k / 8
            bx = cx - bell_w + 2 * bell_w * t
            by = y + bell_h + bell_w * 0.5 * math.sin(math.pi * t) + h * S * 0.05
            r = w * S * 0.035
            md.line([(bx, by - h * S * 0.05), (bx, by)], fill=255, width=int(r * 0.6))
            md.ellipse((bx - r, by - r, bx + r, by + r), fill=255)
            if k % 2 == 0:
                gg = gem(int(r * 1.6), "pearl")
                overlays.append((gg, (int(bx - gg.width / 2), int(by - gg.height / 2))))
        bottom = y + bell_h + bell_w * 0.5 + h * S * 0.09
    elif style == "drop":
        md.line([(cx, y), (cx, y + h * S * 0.3)], fill=255, width=int(w * S * 0.03))
        y += h * S * 0.3
        dw, dh = w * S * 0.3, h * S * 0.28
        md.polygon([(cx, y), (cx + dw, y + dh * 0.55), (cx, y + dh), (cx - dw, y + dh * 0.55)], fill=255)
        g2 = gem(int(dw * 1.1), gem_kind)
        overlays.append((g2, (int(cx - g2.width / 2), int(y + dh * 0.55 - g2.height / 2))))
        bottom = y + dh
    else:  # stud / hoop
        hoop_r = w * S * 0.36
        hy = y + hoop_r * 0.9
        md.ellipse((cx - hoop_r, hy - hoop_r, cx + hoop_r, hy + hoop_r), fill=255)
        md.ellipse((cx - hoop_r * 0.8, hy - hoop_r * 0.8, cx + hoop_r * 0.8, hy + hoop_r * 0.8), fill=0)
        bottom = hy + hoop_r
    image = _finish(canvas, mask, metal, overlays)
    real_h = {"jhumka": 52.0, "drop": 58.0, "hoop": 38.0}.get(style, 50.0)
    return RenderResult(
        image=image,
        anchors={"top": [0.5, (top_y + stud_r) / (h * S)], "bottom": [0.5, bottom / (h * S)]},
        real_width_mm=real_h * w / h,
        real_height_mm=real_h,
    )


def render_ring(
    metal: str = "gold", gem_kind: str = "diamond", *, style: str = "solitaire", size: tuple[int, int] = (800, 600)
) -> RenderResult:
    """Ring try-on cut-out as seen looking down at the back of the hand.

    The band crosses the finger horizontally (slightly arched, following the finger's
    curvature); the far half of the band is hidden by the finger. The head sits centred.
    Anchors: ``band_left``/``band_right`` map to the finger's silhouette edges.
    """
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    overlays: list[tuple[Image.Image, tuple[int, int]]] = []
    cx, cy = w * S / 2, h * S * 0.62
    half = w * S * 0.42
    thick = h * S * (0.1 if style == "band" else 0.075)
    arc_h = h * S * 0.07
    pts = [(cx - half + 2 * half * i / 60, cy + arc_h * math.sin(math.pi * i / 60)) for i in range(61)]
    md.line(pts, fill=255, width=int(thick), joint="curve")
    md.ellipse((cx - half - thick * 0.5, cy - thick * 0.5, cx - half + thick * 0.5, cy + thick * 0.5), fill=255)
    md.ellipse((cx + half - thick * 0.5, cy - thick * 0.5, cx + half + thick * 0.5, cy + thick * 0.5), fill=255)
    band_y = cy + arc_h
    if style == "solitaire":
        head_r = w * S * 0.085
        md.ellipse((cx - head_r, band_y - head_r, cx + head_r, band_y + head_r), fill=255)
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            md.line(
                [(cx, band_y), (cx + head_r * 1.12 * math.cos(a), band_y + head_r * 1.12 * math.sin(a))],
                fill=255,
                width=int(thick * 0.35),
            )
        g = gem(int(head_r * 1.75), gem_kind)
        overlays.append((g, (int(cx - g.width / 2), int(band_y - g.height / 2))))
        top = band_y - head_r * 1.15
    elif style == "halo":
        head_r = w * S * 0.12
        md.ellipse((cx - head_r, band_y - head_r, cx + head_r, band_y + head_r), fill=255)
        g = gem(int(head_r * 1.2), gem_kind)
        overlays.append((g, (int(cx - g.width / 2), int(band_y - g.height / 2))))
        small = gem(int(head_r * 0.4), "diamond")
        for k in range(12):
            a = 2 * math.pi * k / 12
            overlays.append(
                (
                    small,
                    (
                        int(cx + head_r * 0.82 * math.cos(a) - small.width / 2),
                        int(band_y + head_r * 0.82 * math.sin(a) - small.height / 2),
                    ),
                )
            )
        top = band_y - head_r
    else:  # eternity band
        small = gem(int(thick * 0.75), gem_kind)
        for k in range(9):
            t = 0.12 + 0.76 * k / 8
            x, y = pts[int(t * 60)]
            overlays.append((small, (int(x - small.width / 2), int(y - small.height / 2))))
        top = cy - thick * 0.5
    image = _finish(canvas, mask, metal, overlays)
    return RenderResult(
        image=image,
        anchors={
            "center": [0.5, band_y / (h * S)],
            "top": [0.5, top / (h * S)],
            "band_left": [(cx - half) / (w * S), cy / (h * S)],
            "band_right": [(cx + half) / (w * S), cy / (h * S)],
        },
        real_width_mm=20.0,
        real_height_mm=20.0 * h / w,
    )


def render_ring_photo(
    metal: str = "gold", gem_kind: str = "diamond", *, style: str = "solitaire", size: tuple[int, int] = (900, 900)
) -> Image.Image:
    """Full ring for product photography (three-quarter view)."""
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    overlays: list[tuple[Image.Image, tuple[int, int]]] = []
    cx, cy = w * S / 2, h * S * 0.56
    rx, ry = w * S * 0.34, h * S * 0.3
    thick = w * S * (0.075 if style == "band" else 0.06)
    md.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    md.ellipse((cx - rx + thick, cy - ry + thick * 0.85, cx + rx - thick, cy + ry - thick * 0.85), fill=0)
    top_y = cy - ry
    if style in ("solitaire", "halo"):
        head_r = w * S * (0.09 if style == "solitaire" else 0.12)
        md.ellipse((cx - head_r, top_y - head_r * 0.9, cx + head_r, top_y + head_r * 0.9), fill=255)
        g = gem(int(head_r * (1.7 if style == "solitaire" else 1.2)), gem_kind)
        overlays.append((g, (int(cx - g.width / 2), int(top_y - g.height / 2))))
        if style == "halo":
            small = gem(int(head_r * 0.4), "diamond")
            for k in range(12):
                a = 2 * math.pi * k / 12
                overlays.append(
                    (
                        small,
                        (
                            int(cx + head_r * 0.82 * math.cos(a) - small.width / 2),
                            int(top_y + head_r * 0.82 * math.sin(a) - small.height / 2),
                        ),
                    )
                )
    else:
        small = gem(int(thick * 0.7), gem_kind)
        for k in range(11):
            a = math.pi + math.pi * k / 10
            x, y = cx + (rx - thick / 2) * math.cos(a), cy + (ry - thick / 2) * math.sin(a)
            overlays.append((small, (int(x - small.width / 2), int(y - small.height / 2))))
    return _finish(canvas, mask, metal, overlays)


def render_bangle(
    metal: str = "gold", gem_kind: str = "none", *, style: str = "bangle", size: tuple[int, int] = (900, 900)
) -> RenderResult:
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    overlays: list[tuple[Image.Image, tuple[int, int]]] = []
    cx, cy = w * S / 2, h * S / 2
    rx, ry = w * S * 0.46, h * S * 0.3  # perspective ellipse
    thick = w * S * (0.07 if style == "bangle" else 0.035)
    md.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    md.ellipse((cx - rx + thick, cy - ry + thick, cx + rx - thick, cy + ry - thick), fill=0)
    if style == "bracelet":
        for k in range(28):
            a = 2 * math.pi * k / 28
            x, y = cx + (rx - thick / 2) * math.cos(a), cy + (ry - thick / 2) * math.sin(a)
            md.ellipse((x - thick * 0.75, y - thick * 0.75, x + thick * 0.75, y + thick * 0.75), fill=255)
    if gem_kind != "none":
        for k in range(16):
            a = 2 * math.pi * k / 16
            if math.sin(a) < -0.1:
                continue  # back half hidden behind the wrist
            x, y = cx + (rx - thick / 2) * math.cos(a), cy + (ry - thick / 2) * math.sin(a)
            g = gem(int(thick * 0.8), gem_kind)
            overlays.append((g, (int(x - g.width / 2), int(y - g.height / 2))))
    image = _finish(canvas, mask, metal, overlays)
    return RenderResult(
        image=image,
        anchors={"center": [0.5, 0.5], "left": [(cx - rx) / (w * S), 0.5], "right": [(cx + rx) / (w * S), 0.5]},
        real_width_mm=62.0 if style == "bangle" else 60.0,
        real_height_mm=62.0 * h / w if style == "bangle" else 60.0 * h / w,
    )


def render_nose_ring(
    metal: str = "gold", gem_kind: str = "diamond", *, size: tuple[int, int] = (400, 400)
) -> RenderResult:
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    cx, cy = w * S * 0.5, h * S * 0.5
    r = w * S * 0.36
    thick = w * S * 0.05
    md.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    md.ellipse((cx - r + thick, cy - r + thick, cx + r - thick, cy + r - thick), fill=0)
    md.pieslice((cx - r * 1.2, cy - r * 1.2, cx + r * 1.2, cy + r * 1.2), 200, 250, fill=0)  # opening at top-left
    g = gem(int(thick * 2.2), gem_kind)
    overlays = [(g, (int(cx - g.width / 2), int(cy + r - g.height / 2)))]
    image = _finish(canvas, mask, metal, overlays)
    return RenderResult(
        image=image,
        anchors={"pivot": [(cx - r * 0.7) / (w * S), (cy - r * 0.7) / (h * S)], "center": [0.5, 0.5]},
        real_width_mm=12.0,
        real_height_mm=12.0,
    )


def render_maang_tikka(
    metal: str = "gold", gem_kind: str = "kundan", *, size: tuple[int, int] = (500, 900)
) -> RenderResult:
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    cx = w * S / 2
    top = h * S * 0.03
    chain_end = h * S * 0.6
    # chain
    for i in range(22):
        y = top + (chain_end - top) * i / 21
        r = w * S * 0.03
        md.ellipse((cx - r, y - r * 1.2, cx + r, y + r * 1.2), fill=255)
    md.line([(cx, top), (cx, chain_end)], fill=255, width=int(w * S * 0.025))
    # pendant: teardrop with gem cluster
    pw, ph = w * S * 0.36, h * S * 0.3
    py = chain_end + ph * 0.5
    md.polygon([(cx, chain_end), (cx + pw, py), (cx, py + ph * 0.5), (cx - pw, py)], fill=255)
    md.ellipse((cx - pw * 0.95, py - ph * 0.45, cx + pw * 0.95, py + ph * 0.5), fill=255)
    overlays = []
    g = gem(int(pw * 1.0), gem_kind)
    overlays.append((g, (int(cx - g.width / 2), int(py - g.height / 2))))
    small = gem(int(pw * 0.3), "pearl")
    for k in range(7):
        a = math.pi * (0.1 + 0.8 * k / 6)
        overlays.append(
            (
                small,
                (
                    int(cx + pw * 0.95 * math.cos(a) - small.width / 2),
                    int(py + ph * 0.5 * math.sin(a) - small.height / 2 + pw * 0.2),
                ),
            )
        )
    bottom = py + ph * 0.5 + pw * 0.3
    image = _finish(canvas, mask, metal, overlays)
    return RenderResult(
        image=image,
        anchors={"top": [0.5, top / (h * S)], "bottom": [0.5, bottom / (h * S)], "pendant_center": [0.5, py / (h * S)]},
        real_width_mm=36.0,
        real_height_mm=36.0 * h / w,
    )


def render_waist_chain(
    metal: str = "gold", gem_kind: str = "ruby", *, size: tuple[int, int] = (1600, 700)
) -> RenderResult:
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    y_top = h * S * 0.12
    x0, x1 = w * S * 0.04, w * S * 0.96
    pts = _curve_points(w, h, h * S * 0.28, 100, x0, x1, y_top)
    band = h * S * 0.16
    md.line(pts, fill=255, width=int(band), joint="curve")
    overlays = []
    for i in range(1, 24):
        t = i / 24
        x, y = pts[int(t * (len(pts) - 1))]
        r = band * 0.42
        md.ellipse((x - r * 1.1, y - r * 1.1, x + r * 1.1, y + r * 1.1), fill=255)
        g = gem(int(r * 1.3), gem_kind if i % 2 else "pearl")
        overlays.append((g, (int(x - g.width / 2), int(y - g.height / 2))))
        if 0.15 < t < 0.85:
            md.ellipse((x - r * 0.4, y + band * 0.9 - r * 0.8, x + r * 0.4, y + band * 0.9 + r * 0.8), fill=255)
    # central medallion
    bx, by = pts[len(pts) // 2]
    mr = band * 1.4
    md.ellipse((bx - mr, by - mr * 0.6, bx + mr, by + mr * 1.6), fill=255)
    g = gem(int(mr * 1.1), gem_kind)
    overlays.append((g, (int(bx - g.width / 2), int(by + mr * 0.5 - g.height / 2))))
    image = _finish(canvas, mask, metal, overlays)
    return RenderResult(
        image=image,
        anchors={
            "left_end": [x0 / (w * S), y_top / (h * S)],
            "right_end": [x1 / (w * S), y_top / (h * S)],
            "bottom": [0.5, (by + mr * 1.6) / (h * S)],
        },
        real_width_mm=320.0,
        real_height_mm=320.0 * h / w,
    )


def render_anklet(metal: str = "gold", gem_kind: str = "none", *, size: tuple[int, int] = (1000, 500)) -> RenderResult:
    w, h = size
    S = SUPERSAMPLE
    canvas = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    mask = Image.new("L", (w * S, h * S), 0)
    md = ImageDraw.Draw(mask)
    y_top = h * S * 0.15
    x0, x1 = w * S * 0.05, w * S * 0.95
    pts = _curve_points(w, h, h * S * 0.45, 80, x0, x1, y_top)
    md.line(pts, fill=255, width=int(h * S * 0.035), joint="curve")
    overlays = []
    for i in range(1, 18):
        t = i / 18
        x, y = pts[int(t * (len(pts) - 1))]
        r = h * S * 0.028
        md.line([(x, y), (x, y + r * 2.4)], fill=255, width=int(r * 0.5))
        md.ellipse((x - r, y + r * 2.4 - r, x + r, y + r * 2.4 + r), fill=255)
        if gem_kind != "none" and i % 3 == 0:
            g = gem(int(r * 1.6), gem_kind)
            overlays.append((g, (int(x - g.width / 2), int(y + r * 2.4 - g.height / 2))))
    image = _finish(canvas, mask, metal, overlays)
    return RenderResult(
        image=image,
        anchors={
            "left_end": [x0 / (w * S), y_top / (h * S)],
            "right_end": [x1 / (w * S), y_top / (h * S)],
            "bottom": [0.5, (pts[len(pts) // 2][1] + h * S * 0.1) / (h * S)],
        },
        real_width_mm=95.0,
        real_height_mm=95.0 * h / w,
    )


RENDERERS = {
    "necklace": lambda metal, gem_kind, **kw: render_necklace(metal, gem_kind, style=kw.get("style", "necklace")),
    "choker": lambda metal, gem_kind, **kw: render_necklace(metal, gem_kind, style="choker"),
    "haram": lambda metal, gem_kind, **kw: render_necklace(metal, gem_kind, style="haram"),
    "chain": lambda metal, gem_kind, **kw: render_necklace(metal, gem_kind, style="chain"),
    "pendant": lambda metal, gem_kind, **kw: render_necklace(metal, gem_kind, style="pendant"),
    "earrings": lambda metal, gem_kind, **kw: render_earring(metal, gem_kind, style=kw.get("style", "jhumka")),
    "ring": lambda metal, gem_kind, **kw: render_ring(metal, gem_kind, style=kw.get("style", "solitaire")),
    "bangle": lambda metal, gem_kind, **kw: render_bangle(metal, gem_kind, style="bangle"),
    "bracelet": lambda metal, gem_kind, **kw: render_bangle(metal, gem_kind, style="bracelet"),
    "nose_ring": lambda metal, gem_kind, **kw: render_nose_ring(metal, gem_kind),
    "maang_tikka": lambda metal, gem_kind, **kw: render_maang_tikka(metal, gem_kind),
    "waist_chain": lambda metal, gem_kind, **kw: render_waist_chain(metal, gem_kind),
    "anklet": lambda metal, gem_kind, **kw: render_anklet(metal, gem_kind),
}


def render_product_photo(
    asset: Image.Image, size: int = 1200, background: tuple[int, int, int] = (247, 243, 236)
) -> Image.Image:
    """Compose a transparent asset onto a studio background with a soft shadow."""
    canvas = Image.new("RGB", (size, size), background)
    # subtle vignette
    vign = Image.new("L", (size, size), 0)
    vd = ImageDraw.Draw(vign)
    vd.ellipse((-size * 0.2, -size * 0.2, size * 1.2, size * 1.2), fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(size * 0.18))
    darker = Image.new("RGB", (size, size), tuple(int(c * 0.9) for c in background))
    canvas = Image.composite(canvas, darker, vign)
    fit = asset.copy()
    fit.thumbnail((int(size * 0.78), int(size * 0.78)), Image.Resampling.LANCZOS)
    x = (size - fit.width) // 2
    y = (size - fit.height) // 2
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sh = fit.split()[3].point(lambda v: int(v * 0.35))
    shadow.paste((40, 30, 10, 255), (x + int(size * 0.015), y + int(size * 0.03)), sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.02))
    out = canvas.convert("RGBA")
    out.alpha_composite(shadow)
    out.alpha_composite(fit, (x, y))
    return out.convert("RGB")
