"""Derive jewellery placement anchors from detected landmarks.

All geometry here is pure and deterministic so it can be unit-tested and mirrored in the
browser (``frontend/src/lib/tryon/fitting``). Landmark index conventions follow MediaPipe:

Face mesh (478): 10 hairline centre · 151 forehead centre · 1 nose tip · 152 chin ·
33/263 outer eye corners · 234/454 face oval beside the ears · 177/401 near the earlobes ·
98/327 nostril outer edges.
Hands (21): 0 wrist · 5/9/13/17 index/middle/ring/pinky MCP · 6/10/14/18 PIP · 4 thumb tip.
Pose (33): 11/12 shoulders · 23/24 hips · 25/26 knees · 27/28 ankles · 15/16 wrists.
"""

from __future__ import annotations

import math

from jewelora_ai.datatypes import BodyAnchors, Hand, JewelleryType, Landmarks, Point, lerp, midpoint

# Average anthropometrics used to convert pixels to millimetres. These are deliberately
# generic; the UI always presents sizes derived from them as estimates.
AVG_INTER_EYE_OUTER_MM = 90.0  # outer eye corner to outer eye corner
AVG_PALM_WIDTH_MM = 76.0  # index MCP to pinky MCP
AVG_SHOULDER_WIDTH_MM = 380.0

FINGER_SLOTS = {
    "index": (5, 6, 9),
    "middle": (9, 10, 13),
    "ring": (13, 14, 17),
    "pinky": (17, 18, 13),
}


class AnchorError(ValueError):
    """Raised when the landmarks needed for a jewellery type are not available."""


def _angle_deg(a: Point, b: Point) -> float:
    return math.degrees(math.atan2(b.y - a.y, b.x - a.x))


def _perp(v: Point) -> Point:
    """Unit vector perpendicular to v (rotated -90°: points 'left' of the direction)."""
    n = math.hypot(v.x, v.y) or 1.0
    return Point(-v.y / n, v.x / n)


def _unit(v: Point) -> Point:
    n = math.hypot(v.x, v.y) or 1.0
    return Point(v.x / n, v.y / n)


# --- face based ---------------------------------------------------------------------------------


def face_scale(lm: Landmarks) -> tuple[float, float]:
    """(px_per_mm, head roll in degrees) from the outer eye corners, corrected for head yaw."""
    assert lm.face is not None
    left_eye, right_eye = lm.face[33], lm.face[263]
    dist = left_eye.distance_to(right_eye)
    if dist < 8:
        raise AnchorError("face_too_small")
    yaw = abs(face_yaw_ratio(lm))
    foreshortening = max(0.55, math.sqrt(max(0.0, 1.0 - (0.8 * yaw) ** 2)))
    return dist / foreshortening / AVG_INTER_EYE_OUTER_MM, _angle_deg(left_eye, right_eye)


def face_yaw_ratio(lm: Landmarks) -> float:
    """-1..1: negative when the face turns to the image-left, 0 frontal (from nose offset)."""
    assert lm.face is not None
    nose = lm.face[1]
    left, right = lm.face[234], lm.face[454]
    width = right.x - left.x or 1.0
    return float(((nose.x - left.x) / width - 0.5) * 2)


def earring_anchors(lm: Landmarks) -> list[BodyAnchors]:
    if lm.face is None:
        raise AnchorError("no_face")
    px_per_mm, _roll = face_scale(lm)
    yaw = face_yaw_ratio(lm)
    face_w = lm.face[234].distance_to(lm.face[454])
    anchors: list[BodyAnchors] = []
    # Regions are named by IMAGE side. yaw > 0 means the nose sits towards the image-right
    # contour, i.e. the head is turned towards image-right and the image-right ear is hidden.
    for lobe_idx, oval_idx, region, mirror, vis in (
        (177, 234, "left_ear", False, 1.0 + min(0.0, yaw) * 2.0),
        (401, 454, "right_ear", True, 1.0 - max(0.0, yaw) * 2.0),
    ):
        if vis < 0.3:
            continue  # ear hidden by head turn
        lobe = lm.face[lobe_idx]
        oval = lm.face[oval_idx]
        # The lobe landmark lies on the face contour; the visible ear of a turned head sits
        # further out, roughly in proportion to the turn.
        outward = -1.0 if region == "left_ear" else 1.0
        hang = Point(lobe.x + outward * face_w * (0.03 + 0.2 * abs(yaw)), lobe.y + face_w * 0.02)
        anchors.append(
            BodyAnchors(
                region=region,
                points={"top": hang, "oval": oval},
                px_per_mm=px_per_mm,
                rotation_deg=0.0,  # earrings hang with gravity, whatever the head tilt
                confidence=max(0.3, min(1.0, vis)),
                mirror=mirror,
                occlusion={"hair": 0.55},
                squash_x=max(0.6, math.sqrt(max(0.0, 1.0 - (0.8 * yaw) ** 2))),
            )
        )
    if not anchors:
        raise AnchorError("ears_not_visible")
    return anchors


def nose_ring_anchors(lm: Landmarks, side: str = "left") -> BodyAnchors:
    if lm.face is None:
        raise AnchorError("no_face")
    px_per_mm, roll = face_scale(lm)
    idx = 98 if side == "left" else 327
    nostril = lm.face[idx]
    return BodyAnchors(
        region=f"{side}_nostril",
        points={"pivot": nostril},
        px_per_mm=px_per_mm,
        rotation_deg=roll,
        confidence=0.9,
        mirror=side == "right",
    )


def maang_tikka_anchors(lm: Landmarks) -> BodyAnchors:
    if lm.face is None:
        raise AnchorError("no_face")
    px_per_mm, roll = face_scale(lm)
    hairline = lm.face[10]
    forehead = lm.face[151]
    brow_mid = lm.face[9]
    # Tikka pendant sits between the hairline and the brows; chain runs up into the parting.
    pendant = lerp(forehead, brow_mid, 0.25)
    top = lerp(hairline, forehead, -0.55)  # above the hairline into the hair
    return BodyAnchors(
        region="forehead",
        points={"top": top, "pendant_center": pendant, "bottom": lerp(pendant, brow_mid, 0.6)},
        px_per_mm=px_per_mm,
        rotation_deg=roll + 90.0,  # asset's top→bottom axis maps to the head's vertical axis
        confidence=0.85,
        occlusion={"hair": 0.45},
    )


# --- neck based ---------------------------------------------------------------------------


def _shoulders_plausible(lm: Landmarks, chin: Point, face_w: float) -> bool:
    """Pose shoulders are only trusted when they sit below the chin at a believable width."""
    if lm.pose is None or lm.pose_visibility is None:
        return False
    if min(lm.pose_visibility[11], lm.pose_visibility[12]) < 0.5:
        return False
    l_sh, r_sh = lm.pose[11], lm.pose[12]
    for p in (l_sh, r_sh):
        if not (0 <= p.x <= lm.image_width and 0 <= p.y <= lm.image_height):
            return False
    mid = midpoint(l_sh, r_sh)
    width = l_sh.distance_to(r_sh)
    return mid.y > chin.y + face_w * 0.15 and 1.3 * face_w <= width <= 5.0 * face_w


def neck_anchors(lm: Landmarks, jewellery_type: JewelleryType) -> BodyAnchors:
    if lm.face is None:
        raise AnchorError("no_face")
    chin = lm.face[152]
    px_per_mm, roll = face_scale(lm)
    face_w = lm.face[234].distance_to(lm.face[454])
    confidence = 0.6
    if _shoulders_plausible(lm, chin, face_w):
        assert lm.pose is not None
        l_sh, r_sh = lm.pose[11], lm.pose[12]  # person's left (image right) / person's right
        shoulder_mid = midpoint(l_sh, r_sh)
        shoulder_w = l_sh.distance_to(r_sh)
        roll = _angle_deg(r_sh, l_sh)
        # Neck base lies between chin and the shoulder line; width ≈ 42% of shoulder width.
        neck_base = lerp(chin, shoulder_mid, 0.66)
        half_w = shoulder_w * 0.23
        px_per_mm = (px_per_mm + shoulder_w / AVG_SHOULDER_WIDTH_MM) / 2
        confidence = 0.9
    else:
        # Fall back to face proportions when shoulders are not visible.
        neck_base = Point(chin.x, chin.y + face_w * 0.55)
        half_w = face_w * 0.5
        confidence = 0.55
    rad = math.radians(roll)
    along = Point(math.cos(rad), math.sin(rad))
    left_end = Point(neck_base.x - along.x * half_w, neck_base.y - along.y * half_w)
    right_end = Point(neck_base.x + along.x * half_w, neck_base.y + along.y * half_w)
    occl = {"hair": 0.55}
    return BodyAnchors(
        region="neck",
        points={"left_end": left_end, "right_end": right_end, "center": neck_base},
        px_per_mm=px_per_mm,
        rotation_deg=roll,
        confidence=confidence,
        occlusion=occl,
    )


# --- hand based ---------------------------------------------------------------------------


def hand_scale(hand: Hand) -> float:
    palm = hand.points[5].distance_to(hand.points[17])
    if palm < 10:
        raise AnchorError("hand_too_small")
    return palm / AVG_PALM_WIDTH_MM


def finger_width_px(hand: Hand, finger: str) -> float:
    """Approximate finger width at its base from the spacing of neighbouring knuckles."""
    pts = hand.points
    if finger == "ring":
        return (pts[9].distance_to(pts[13]) + pts[13].distance_to(pts[17])) / 2 * 0.92
    if finger == "middle":
        return (pts[5].distance_to(pts[9]) + pts[9].distance_to(pts[13])) / 2 * 0.95
    if finger == "index":
        return pts[5].distance_to(pts[9]) * 0.95
    return pts[13].distance_to(pts[17]) * 0.8  # pinky


def ring_anchors(hand: Hand, finger: str = "ring") -> BodyAnchors:
    mcp_idx, pip_idx, _ = FINGER_SLOTS[finger]
    mcp, pip = hand.points[mcp_idx], hand.points[pip_idx]
    if mcp.distance_to(pip) < 6:
        raise AnchorError("finger_not_visible")
    direction = _unit(pip - mcp)
    centre = lerp(mcp, pip, 0.38)  # rings sit on the lower third of the proximal phalanx
    width = finger_width_px(hand, finger)
    side = _perp(direction).scaled(width / 2)
    return BodyAnchors(
        region=f"{hand.handedness.lower()}_{finger}_finger",
        points={"band_left": centre - side, "band_right": centre + side, "center": centre},
        px_per_mm=hand_scale(hand),
        rotation_deg=_angle_deg(centre - side, centre + side),
        confidence=max(0.4, hand.score),
    )


def wrist_anchors(hand: Hand) -> BodyAnchors:
    wrist, middle_mcp = hand.points[0], hand.points[9]
    palm_w = hand.points[5].distance_to(hand.points[17])
    direction = _unit(wrist - middle_mcp)  # towards the forearm
    centre = wrist + direction.scaled(palm_w * 0.22)
    half = palm_w * 0.46
    side = _perp(direction).scaled(half)
    return BodyAnchors(
        region=f"{hand.handedness.lower()}_wrist",
        points={"left": centre - side, "right": centre + side, "center": centre},
        px_per_mm=hand_scale(hand),
        rotation_deg=_angle_deg(centre - side, centre + side),
        confidence=max(0.4, hand.score),
    )


# --- pose based ---------------------------------------------------------------------------


def _pose_visible(lm: Landmarks, *indices: int, threshold: float = 0.5) -> bool:
    if lm.pose is None or lm.pose_visibility is None:
        return False
    return all(lm.pose_visibility[i] > threshold for i in indices)


def waist_anchors(lm: Landmarks) -> BodyAnchors:
    if not _pose_visible(lm, 23, 24, 11, 12):
        raise AnchorError("hips_not_visible")
    assert lm.pose is not None
    l_hip, r_hip = lm.pose[23], lm.pose[24]
    shoulder_w = lm.pose[11].distance_to(lm.pose[12])
    hip_w = l_hip.distance_to(r_hip)
    mid = midpoint(l_hip, r_hip)
    torso = midpoint(lm.pose[11], lm.pose[12])
    waist = lerp(mid, torso, 0.12)
    roll = _angle_deg(r_hip, l_hip)
    rad = math.radians(roll)
    half = hip_w * 0.7
    along = Point(math.cos(rad), math.sin(rad))
    return BodyAnchors(
        region="waist",
        points={
            "left_end": Point(waist.x - along.x * half, waist.y - along.y * half),
            "right_end": Point(waist.x + along.x * half, waist.y + along.y * half),
            "center": waist,
        },
        px_per_mm=shoulder_w / AVG_SHOULDER_WIDTH_MM,
        rotation_deg=roll,
        confidence=0.7,
        occlusion={"hair": 0.6},
    )


def anklet_anchors(lm: Landmarks, side: str = "left") -> BodyAnchors:
    ankle_idx, knee_idx = (27, 25) if side == "left" else (28, 26)
    if not _pose_visible(lm, ankle_idx, knee_idx):
        raise AnchorError("ankle_not_visible")
    assert lm.pose is not None
    ankle, knee = lm.pose[ankle_idx], lm.pose[knee_idx]
    shin = ankle.distance_to(knee)
    direction = _unit(ankle - knee)
    centre = ankle - direction.scaled(shin * 0.06)
    half = shin * 0.11
    side_v = _perp(direction).scaled(half)
    shoulder_w = lm.pose[11].distance_to(lm.pose[12]) if _pose_visible(lm, 11, 12) else shin * 1.1
    return BodyAnchors(
        region=f"{side}_ankle",
        points={"left_end": centre - side_v, "right_end": centre + side_v, "center": centre},
        px_per_mm=shoulder_w / AVG_SHOULDER_WIDTH_MM,
        rotation_deg=_angle_deg(centre - side_v, centre + side_v),
        confidence=0.65,
    )


# --- dispatcher ---------------------------------------------------------------------------


def pick_hand(lm: Landmarks, slot: str | None) -> Hand:
    if not lm.hands:
        raise AnchorError("no_hand")
    if slot:
        for hand in lm.hands:
            if slot.startswith(hand.handedness.lower()):
                return hand
    return max(lm.hands, key=lambda h: h.score)


def anchors_for(
    lm: Landmarks, jewellery_type: JewelleryType, slot: str | None = None
) -> list[BodyAnchors]:
    """All placements for one item (earrings produce up to two)."""
    if jewellery_type in {
        JewelleryType.NECKLACE,
        JewelleryType.CHAIN,
        JewelleryType.PENDANT,
        JewelleryType.HARAM,
        JewelleryType.CHOKER,
    }:
        return [neck_anchors(lm, jewellery_type)]
    if jewellery_type == JewelleryType.EARRINGS:
        return earring_anchors(lm)
    if jewellery_type == JewelleryType.NOSE_RING:
        return [nose_ring_anchors(lm, "right" if slot == "right_nostril" else "left")]
    if jewellery_type == JewelleryType.MAANG_TIKKA:
        return [maang_tikka_anchors(lm)]
    if jewellery_type == JewelleryType.RING:
        finger = (slot or "ring").split("_")[-1] if slot else "ring"
        if finger not in FINGER_SLOTS:
            finger = "ring"
        return [ring_anchors(pick_hand(lm, slot), finger)]
    if jewellery_type in {JewelleryType.BANGLE, JewelleryType.BRACELET}:
        return [wrist_anchors(pick_hand(lm, slot))]
    if jewellery_type == JewelleryType.WAIST_CHAIN:
        return [waist_anchors(lm)]
    if jewellery_type == JewelleryType.ANKLET:
        return [anklet_anchors(lm, "right" if slot == "right_ankle" else "left")]
    raise AnchorError(f"unsupported_type:{jewellery_type}")
