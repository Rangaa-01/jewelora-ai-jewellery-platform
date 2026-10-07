"""Procedural GLB jewellery models for development seed data (trimesh).

Simple but recognisable geometry with PBR materials so the 3D viewer, material switching
and lighting can be exercised end to end. Real products use models uploaded by the shop.
"""

from __future__ import annotations

import math

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

METAL_RGB = {
    "gold": (1.0, 0.78, 0.35),
    "rose_gold": (0.95, 0.65, 0.55),
    "white_gold": (0.93, 0.93, 0.95),
    "platinum": (0.88, 0.89, 0.92),
    "silver": (0.9, 0.9, 0.92),
}
GEM_RGB = {
    "diamond": (0.97, 0.98, 1.0),
    "ruby": (0.75, 0.05, 0.15),
    "emerald": (0.05, 0.6, 0.35),
    "sapphire": (0.1, 0.2, 0.75),
    "pearl": (0.98, 0.96, 0.9),
    "polki": (0.95, 0.92, 0.8),
    "kundan": (0.95, 0.9, 0.7),
    "cz": (0.97, 0.98, 1.0),
    "none": (0.95, 0.9, 0.7),
}


def _metal_material(metal: str) -> PBRMaterial:
    r, g, b = METAL_RGB.get(metal, METAL_RGB["gold"])
    return PBRMaterial(
        name=f"{metal}_metal",
        baseColorFactor=[r, g, b, 1.0],
        metallicFactor=1.0,
        roughnessFactor=0.22,
    )


def _gem_material(gem: str) -> PBRMaterial:
    r, g, b = GEM_RGB.get(gem, GEM_RGB["diamond"])
    return PBRMaterial(
        name=f"{gem}_gem",
        baseColorFactor=[r, g, b, 0.92 if gem in ("diamond", "cz", "sapphire", "emerald", "ruby") else 1.0],
        metallicFactor=0.0,
        roughnessFactor=0.05,
        alphaMode="BLEND" if gem in ("diamond", "cz") else "OPAQUE",
    )


def _with_material(mesh: trimesh.Trimesh, material: PBRMaterial) -> trimesh.Trimesh:
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    return mesh


def _gem_mesh(radius: float, gem: str) -> trimesh.Trimesh:
    # brilliant-ish cut: a cone (pavilion) + truncated cone (crown)
    pav = trimesh.creation.cone(radius=radius, height=radius * 0.9, sections=16)
    pav.apply_transform(trimesh.transformations.rotation_matrix(math.pi, [1, 0, 0]))
    crown = trimesh.creation.cylinder(radius=radius, height=radius * 0.35, sections=16)
    crown.apply_translation([0, 0, radius * 0.175])
    table = trimesh.creation.cylinder(radius=radius * 0.6, height=radius * 0.12, sections=16)
    table.apply_translation([0, 0, radius * 0.41])
    mesh = trimesh.util.concatenate([pav, crown, table])
    return _with_material(mesh, _gem_material(gem))


def ring(metal: str = "gold", gem: str = "diamond", style: str = "solitaire") -> trimesh.Scene:
    inner_r = 8.5  # mm
    band_r = 1.1 if style != "band" else 1.6
    # The torus is created in the XY plane, so the ring stands upright with the head at +Y.
    band = trimesh.creation.torus(
        major_radius=inner_r + band_r, minor_radius=band_r, major_sections=96, minor_sections=24
    )
    scene = trimesh.Scene()
    scene.add_geometry(_with_material(band, _metal_material(metal)), node_name="band")
    top_y = inner_r + band_r
    if style == "solitaire":
        head = trimesh.creation.cylinder(radius=2.2, height=2.4, sections=24)
        head.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
        head.apply_translation([0, top_y + 1.0, 0])
        scene.add_geometry(_with_material(head, _metal_material(metal)), node_name="head")
        stone = _gem_mesh(2.4, gem)
        stone.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0]))
        stone.apply_translation([0, top_y + 2.3, 0])
        scene.add_geometry(stone, node_name="stone")
    elif style == "halo":
        head = trimesh.creation.cylinder(radius=3.4, height=2.0, sections=32)
        head.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
        head.apply_translation([0, top_y + 0.8, 0])
        scene.add_geometry(_with_material(head, _metal_material(metal)), node_name="head")
        stone = _gem_mesh(2.0, gem)
        stone.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0]))
        stone.apply_translation([0, top_y + 2.0, 0])
        scene.add_geometry(stone, node_name="stone")
        for k in range(12):
            a = 2 * math.pi * k / 12
            s = _gem_mesh(0.55, "diamond")
            s.apply_transform(trimesh.transformations.rotation_matrix(-math.pi / 2, [1, 0, 0]))
            s.apply_translation([2.9 * math.cos(a), top_y + 1.9, 2.9 * math.sin(a)])
            scene.add_geometry(s, node_name=f"halo_{k}")
    else:
        for k in range(14):
            a = 2 * math.pi * k / 14
            s = _gem_mesh(0.8, gem)
            s.apply_transform(trimesh.transformations.rotation_matrix(a + math.pi / 2, [0, 0, 1]))
            r = inner_r + band_r * 1.6
            s.apply_translation([r * math.cos(a), r * math.sin(a), 0])
            scene.add_geometry(s, node_name=f"stone_{k}")
    return scene


def bangle(metal: str = "gold", gem: str = "none", style: str = "bangle") -> trimesh.Scene:
    inner_r = 31.0
    minor = 3.0 if style == "bangle" else 1.4
    band = trimesh.creation.torus(
        major_radius=inner_r + minor, minor_radius=minor, major_sections=128, minor_sections=24
    )
    scene = trimesh.Scene()
    scene.add_geometry(_with_material(band, _metal_material(metal)), node_name="band")
    if style == "bracelet":
        for k in range(24):
            a = 2 * math.pi * k / 24
            bead = trimesh.creation.icosphere(subdivisions=2, radius=minor * 1.6)
            bead.apply_translation([(inner_r + minor) * math.cos(a), (inner_r + minor) * math.sin(a), 0])
            scene.add_geometry(_with_material(bead, _metal_material(metal)), node_name=f"bead_{k}")
    if gem != "none":
        for k in range(16):
            a = 2 * math.pi * k / 16
            s = _gem_mesh(minor * 0.7, gem)
            s.apply_translation([(inner_r + minor) * math.cos(a), (inner_r + minor) * math.sin(a), minor * 0.9])
            scene.add_geometry(s, node_name=f"stone_{k}")
    return scene


def necklace(metal: str = "gold", gem: str = "ruby", style: str = "necklace") -> trimesh.Scene:
    """A strand of linked beads along a U-curve with a pendant."""
    scene = trimesh.Scene()
    width = {"choker": 110.0, "necklace": 150.0, "haram": 160.0, "chain": 140.0, "pendant": 140.0}[style]
    depth = {"choker": 35.0, "necklace": 80.0, "haram": 150.0, "chain": 90.0, "pendant": 90.0}[style]
    n = 40 if style not in ("chain", "pendant") else 70
    pts = []
    for i in range(n + 1):
        t = i / n
        x = -width / 2 + width * t
        y = -depth * math.sin(math.pi * t) ** 0.8
        pts.append([x, y, 0.0])
    arr = np.array(pts)
    bead_r = {"choker": 3.2, "necklace": 3.0, "haram": 2.8, "chain": 1.2, "pendant": 1.2}[style]
    for i, p in enumerate(arr):
        bead = trimesh.creation.icosphere(subdivisions=1, radius=bead_r * (0.8 + 0.4 * math.sin(math.pi * i / n)))
        bead.apply_translation(p)
        scene.add_geometry(_with_material(bead, _metal_material(metal)), node_name=f"bead_{i}")
        if style not in ("chain", "pendant") and i % 2 == 0 and 0 < i < n:
            s = _gem_mesh(bead_r * 0.6, gem)
            s.apply_translation(p + np.array([0, 0, bead_r * 0.8]))
            scene.add_geometry(s, node_name=f"stone_{i}")
    if style in ("necklace", "haram", "pendant"):
        bottom = arr[n // 2]
        pend = trimesh.creation.cylinder(radius=9.0, height=2.5, sections=32)
        pend.apply_translation(bottom + np.array([0, -9.5, 0]))
        scene.add_geometry(_with_material(pend, _metal_material(metal)), node_name="pendant")
        s = _gem_mesh(5.0, gem)
        s.apply_translation(bottom + np.array([0, -9.5, 1.5]))
        scene.add_geometry(s, node_name="pendant_stone")
    return scene


def earring(metal: str = "gold", gem: str = "emerald", style: str = "jhumka") -> trimesh.Scene:
    scene = trimesh.Scene()
    stud = trimesh.creation.icosphere(subdivisions=2, radius=3.0)
    scene.add_geometry(_with_material(stud, _metal_material(metal)), node_name="stud")
    s = _gem_mesh(2.2, gem)
    s.apply_translation([0, 0, 2.2])
    scene.add_geometry(s, node_name="stud_stone")
    if style == "jhumka":
        bell = trimesh.creation.cone(radius=9.0, height=14.0, sections=32)
        bell.apply_transform(trimesh.transformations.rotation_matrix(math.pi, [1, 0, 0]))
        bell.apply_translation([0, -8.0, 0])
        bell.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
        bell.apply_translation([0, -4.0, 0])
        scene.add_geometry(_with_material(bell, _metal_material(metal)), node_name="bell")
        for k in range(10):
            a = 2 * math.pi * k / 10
            bead = trimesh.creation.icosphere(subdivisions=1, radius=1.2)
            bead.apply_translation([8.0 * math.cos(a), -20.0, 8.0 * math.sin(a)])
            scene.add_geometry(_with_material(bead, _gem_material("pearl")), node_name=f"bead_{k}")
    else:
        drop = _gem_mesh(5.0, gem)
        drop.apply_translation([0, -16.0, 0])
        scene.add_geometry(drop, node_name="drop")
        link = trimesh.creation.cylinder(radius=0.5, height=12.0, sections=12)
        link.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
        link.apply_translation([0, -8.0, 0])
        scene.add_geometry(_with_material(link, _metal_material(metal)), node_name="link")
    return scene


BUILDERS = {
    "ring": ring,
    "bangle": lambda metal, gem, style="bangle": bangle(metal, gem, "bangle"),
    "bracelet": lambda metal, gem, style="bracelet": bangle(metal, gem, "bracelet"),
    "necklace": lambda metal, gem, style="necklace": necklace(
        metal, gem, style if style in ("necklace", "choker", "haram", "chain", "pendant") else "necklace"
    ),
    "choker": lambda metal, gem, style="choker": necklace(metal, gem, "choker"),
    "haram": lambda metal, gem, style="haram": necklace(metal, gem, "haram"),
    "chain": lambda metal, gem, style="chain": necklace(metal, gem, "chain"),
    "pendant": lambda metal, gem, style="pendant": necklace(metal, gem, "pendant"),
    "earrings": lambda metal, gem, style="jhumka": earring(metal, gem, style),
}


def export_glb(scene: trimesh.Scene) -> bytes:
    data = scene.export(file_type="glb")
    assert isinstance(data, bytes)
    return data
