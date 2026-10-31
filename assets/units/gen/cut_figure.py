"""Cuts a generated character (assets/units/<class>/gen/<class>-source.png) into its rig's pieces.

The same method as the knight's cut.py, for the classes drawn by editing the knight's picture
(assets/specs/chatgpt-projet.md): same canvas, 16 source px to a rig px. Each class below gives
its joints and the polygons of its parts, read on the painting. Limbs are turned to hang straight
(the shared animations assume it), a foot pointing backwards is turned round, and each part is
split by colour into the house's first colour (light grey), its second colour (medium grey) and
the rest, drawn over them untinted. Writes assets/units/<class>/<class>.svg and the bones and
pieces of src/content/rigs/<class>/rig.json; `pnpm run art` then renders the pieces at x2.
Run from the repository root: python assets/units/gen/cut_figure.py [class ...]
"""

import base64
import io
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

ROOT = Path(__file__).parents[3]
S = 16  # source px per rig px
EMBED = 4 / S  # pictures embedded at x4 rig px, twice the x2 they are rendered at
OVER = 18  # source px each limb part overlaps the next
INK = "#2a1d14"

# Joints and parts per class, in source px. Arms: "near" is the one on the left of the picture
# (it holds the weapons), "far" the one on the right; legs: "far" left, "near" right.
CLASSES = {
    "archer": dict(
        cx=558, waist=770, pelvis=1000, neck=(560, 442),
        head=[(345, 10), (800, 10), (800, 330), (730, 400), (690, 440), (560, 452), (440, 446),
              (398, 420), (382, 380), (345, 300)],
        torso=[(330, 425), (775, 425), (780, 560), (735, 600), (705, 650), (697, 710), (701, 800),
               (733, 890), (774, 1040), (745, 1084), (560, 1092), (360, 1084), (326, 1040),
               (357, 950), (380, 890), (415, 800), (381, 740), (366, 706), (400, 650), (420, 600),
               (330, 560)],
        back=[("quiver", [(180, 228), (345, 228), (345, 380), (392, 420), (420, 600), (412, 720),
                          (381, 742), (330, 700), (298, 600), (258, 520), (238, 420), (180, 330)])],
        arms=dict(
            near=dict(poly=[(300, 560), (395, 560), (420, 600), (400, 660), (366, 712), (330, 780),
                            (322, 830), (330, 880), (300, 928), (240, 932), (184, 900), (188, 850),
                            (212, 800), (240, 720), (270, 650), (290, 600)],
                      shoulder=(355, 600), elbow=(300, 720), wrist=(262, 812), hand=(245, 872)),
            far=dict(poly=[(690, 560), (772, 560), (800, 640), (812, 700), (842, 800), (866, 860),
                           (868, 900), (852, 932), (790, 932), (754, 890), (756, 840), (740, 800),
                           (705, 720), (695, 640)],
                     shoulder=(712, 600), elbow=(755, 715), wrist=(788, 812), hand=(808, 875)),
        ),
        legs=dict(
            far=dict(quad=[(350, 1092), (478, 1092), (438, 1236), (310, 1236)], hip=(446, 1000),
                     ankle=(375, 1226), foot=(292, 1196, 516), mirror=False),
            near=dict(quad=[(624, 1092), (746, 1092), (778, 1236), (652, 1236)], hip=(658, 1000),
                      ankle=(715, 1226), foot=(648, 1196, 892), mirror=False),
        ),
    ),
    "sapper": dict(
        cx=553, waist=770, pelvis=1000, neck=(520, 457),
        head=[(370, 10), (790, 10), (790, 380), (700, 442), (600, 460), (470, 460), (430, 442),
              (390, 402), (376, 300), (360, 150)],
        torso=[(398, 450), (702, 450), (704, 600), (712, 700), (718, 770), (726, 830), (744, 890),
               (764, 950), (792, 1040), (766, 1078), (560, 1094), (346, 1080), (308, 1040),
               (329, 950), (350, 890), (375, 830), (389, 800), (405, 770), (401, 712), (420, 620),
               (430, 540)],
        back=[("pick", [(100, 288), (392, 288), (392, 340), (352, 420), (346, 480), (332, 572),
                        (290, 602), (100, 602)])],
        arms=dict(
            near=dict(poly=[(308, 470), (396, 470), (432, 540), (420, 620), (402, 700), (366, 744),
                            (336, 792), (322, 842), (328, 896), (290, 932), (218, 934), (184, 892),
                            (194, 830), (208, 760), (238, 680), (278, 560)],
                      shoulder=(385, 560), elbow=(322, 690), wrist=(268, 805), hand=(255, 870)),
            far=dict(poly=[(690, 470), (762, 500), (802, 600), (832, 700), (854, 780), (872, 860),
                           (868, 906), (840, 932), (788, 932), (754, 892), (750, 800), (722, 772),
                           (712, 700), (700, 600)],
                     shoulder=(715, 540), elbow=(770, 680), wrist=(805, 800), hand=(812, 870)),
        ),
        legs=dict(
            far=dict(quad=[(336, 1092), (484, 1092), (480, 1164), (316, 1164)], hip=(420, 1000),
                     ankle=(392, 1214), foot=(296, 1150, 552), mirror=False),
            near=dict(quad=[(614, 1092), (762, 1092), (772, 1164), (620, 1164)], hip=(680, 1000),
                      ankle=(705, 1214), foot=(612, 1150, 902), mirror=False),
        ),
    ),
    "slinger": dict(
        cx=560, waist=750, pelvis=950, neck=(540, 445),
        head=[(270, 10), (790, 10), (790, 330), (720, 380), (624, 410), (618, 448), (560, 462),
              (470, 462), (462, 432), (420, 412), (380, 392), (300, 330), (270, 200)],
        torso=[(394, 465), (690, 465), (690, 600), (695, 682), (706, 714), (745, 760), (772, 800),
               (774, 950), (770, 1000), (752, 1026), (560, 1032), (390, 1026), (352, 992),
               (360, 950), (380, 890), (400, 830), (411, 800), (421, 770), (410, 712), (400, 684),
               (404, 600)],
        arms=dict(
            near=dict(poly=[(330, 480), (402, 480), (406, 560), (402, 640), (368, 684), (342, 740),
                            (322, 780), (318, 830), (330, 880), (302, 928), (228, 932), (184, 892),
                            (196, 830), (222, 790), (250, 700), (300, 560)],
                      shoulder=(375, 530), elbow=(318, 670), wrist=(272, 800), hand=(250, 875)),
            far=dict(poly=[(682, 480), (722, 490), (762, 600), (804, 680), (833, 770), (862, 830),
                           (877, 890), (857, 928), (798, 928), (767, 880), (770, 830), (745, 772),
                           (704, 714), (690, 684), (686, 600)],
                     shoulder=(685, 530), elbow=(740, 660), wrist=(790, 790), hand=(815, 870)),
        ),
        legs=dict(
            far=dict(quad=[(384, 1030), (502, 1030), (438, 1234), (326, 1234)], hip=(455, 950),
                     ankle=(382, 1222), foot=(298, 1202, 526), mirror=False),
            near=dict(quad=[(610, 1030), (726, 1030), (768, 1234), (648, 1234)], hip=(655, 950),
                      ankle=(706, 1216), foot=(638, 1202, 896), mirror=False),
        ),
    ),
    "cleric": dict(
        cx=540, waist=790, pelvis=1080, neck=(520, 432),
        head=[(250, 60), (800, 60), (805, 250), (762, 330), (722, 400), (662, 426), (560, 432),
              (470, 430), (420, 412), (380, 372), (300, 332), (250, 250)],
        torso=[(330, 428), (560, 412), (702, 438), (702, 540), (722, 620), (732, 700), (747, 770),
               (782, 800), (802, 960), (832, 1000), (802, 1062), (797, 1174), (560, 1184),
               (330, 1177), (248, 1132), (240, 1000), (298, 950), (318, 880), (345, 790),
               (380, 720), (402, 650), (395, 595), (360, 545), (320, 515)],
        hand_far_items=[("crosier", [(822, 0), (1082, 0), (1082, 212), (902, 222), (902, 1320),
                                     (800, 1320), (810, 1252), (838, 1232), (838, 600), (832, 300),
                                     (822, 100)])],
        arms=dict(
            near=dict(poly=[(295, 505), (322, 515), (362, 545), (397, 595), (404, 650), (382, 720),
                            (347, 790), (327, 830), (312, 880), (302, 922), (250, 937), (183, 932),
                            (168, 880), (176, 800), (188, 760), (218, 700), (258, 600)],
                      shoulder=(330, 562), elbow=(285, 682), wrist=(250, 802), hand=(232, 872)),
            # The crozier's arm, bent round the staff: kept as drawn, in two parts.
            far=dict(parts=dict(
                upper=[(700, 538), (752, 558), (792, 590), (830, 598), (842, 700), (832, 777),
                       (780, 787), (745, 772), (730, 700), (720, 620)],
                hand=[(810, 580), (932, 580), (932, 737), (810, 737)]),
                shoulder=(720, 580), elbow=(780, 690), wrist=(822, 652), hand=(870, 655)),
        ),
        legs=dict(
            far=dict(quad=[(330, 1180), (454, 1180), (454, 1242), (330, 1242)], hip=(392, 1080),
                     ankle=(392, 1232), foot=(254, 1226, 470), mirror=True),
            near=dict(quad=[(636, 1180), (766, 1180), (766, 1242), (636, 1242)], hip=(700, 1080),
                      ankle=(700, 1232), foot=(630, 1226, 832), mirror=False),
        ),
    ),
    "king": dict(
        cx=565, waist=760, pelvis=1080, neck=(520, 462),
        head=[(290, 0), (750, 0), (812, 300), (817, 482), (792, 522), (722, 532), (652, 502),
              (600, 472), (540, 442), (470, 427), (400, 427), (340, 422), (300, 342), (300, 200)],
        torso=[(270, 420), (772, 420), (762, 560), (702, 582), (702, 640), (717, 720), (727, 800),
               (752, 900), (792, 1000), (802, 1100), (802, 1177), (560, 1187), (270, 1180),
               (248, 1100), (268, 1000), (322, 932), (347, 880), (392, 780), (417, 700),
               (437, 620), (442, 587), (330, 560)],
        back=[("mantle", [(250, 538), (330, 553), (300, 620), (250, 720), (215, 800), (195, 840),
                          (195, 940), (305, 950), (270, 1050), (252, 1150), (332, 1217),
                          (250, 1247), (98, 1242), (58, 1202), (100, 1000), (150, 800),
                          (200, 640)])],
        # The near hand hid part of the mantle's lining: filled with ermine where it was.
        patch=dict(mantle=[([(195, 800), (320, 800), (320, 948), (195, 948)], (254, 246, 234))]),
        arms=dict(
            near=dict(poly=[(320, 550), (442, 585), (432, 650), (412, 720), (392, 780), (347, 830),
                            (322, 860), (312, 900), (292, 932), (215, 937), (193, 900),
                            (198, 840), (210, 800), (240, 700), (280, 620), (305, 570)],
                      shoulder=(370, 600), elbow=(330, 700), wrist=(290, 810), hand=(255, 875)),
            far=dict(poly=[(690, 560), (742, 560), (792, 640), (842, 720), (867, 790), (872, 850),
                           (862, 900), (832, 937), (785, 932), (758, 890), (745, 840), (725, 800),
                           (715, 720), (700, 640)],
                     shoulder=(720, 600), elbow=(770, 710), wrist=(810, 815), hand=(812, 875)),
        ),
        legs=dict(
            far=dict(quad=[(334, 1182), (436, 1182), (436, 1246), (334, 1246)], hip=(385, 1080),
                     ankle=(385, 1236), foot=(238, 1238, 446), mirror=True),
            near=dict(quad=[(640, 1182), (754, 1182), (754, 1246), (640, 1246)], hip=(697, 1080),
                      ankle=(700, 1236), foot=(638, 1238, 918), mirror=False),
        ),
    ),
}


def load(cls):
    src = Image.open(ROOT / f"assets/units/{cls}/gen/{cls}-source.png").convert("RGB")
    grey = src.convert("L").point(lambda v: 255 if v > 228 else 0)
    ImageDraw.floodfill(grey, (0, 0), 128)
    img = src.copy()
    img.putalpha(grey.point(lambda v: 0 if v == 128 else 255))
    return img


def poly_mask(size, points):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return m


def cut(img, mask):
    out = img.copy()
    out.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
    return out


def rows(img, y0, y1):
    return cut(img, poly_mask(img.size, [(0, y0), (img.width, y0), (img.width, y1), (0, y1)]))


def moved(img, angle, centre, to):
    """img turned by angle (degrees, counter-clockwise) about centre, centre then put at `to`."""
    return shift(img.rotate(angle, resample=Image.BICUBIC, center=centre), to[0] - centre[0],
                 to[1] - centre[1])


def shift(img, dx, dy):
    """img moved by (dx, dy), what leaves the canvas lost (no wrapping round)."""
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(img.crop((max(0, -round(dx)), max(0, -round(dy)), img.width, img.height)),
                        (max(0, round(dx)), max(0, round(dy))))
    return out


def upright(a, b):
    """The turn (PIL degrees) that makes a->b point straight down."""
    return -math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))


def below(a, b, length=None):
    return (a[0], a[1] + (math.dist(a, b) if length is None else length))


def colour_split(img):
    """The house's first colour (light greys), its second (medium greys), and the rest."""
    rgb = img.convert("RGB")
    r, g, b = rgb.split()
    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    grey = ImageChops.difference(hi, lo).point(lambda v: 255 if v <= 24 else 0)
    lum = rgb.convert("L")
    first = ImageChops.multiply(grey, lum.point(lambda v: 255 if 170 <= v < 236 else 0))
    second = ImageChops.multiply(grey, lum.point(lambda v: 255 if 105 <= v < 170 else 0))
    rest = ImageChops.invert(ImageChops.lighter(first, second))
    a = img.getchannel("A")

    def layer(m, neutral):
        out = (ImageOps.grayscale(rgb).convert("RGB") if neutral else rgb).copy()
        out.putalpha(ImageChops.multiply(a, m))
        return out

    return layer(first, True), layer(second, True), layer(rest, False)


def visible(img):
    """Enough of it to be seen: a colour layer of a few stray edge pixels is left out."""
    return img.getchannel("A").point(lambda v: 1 if v > 24 else 0).histogram()[1] > 600


def build(cls):
    c = CLASSES[cls]
    img = load(cls)
    size = img.size
    box = img.getchannel("A").getbbox()
    OX, OY = c["cx"], box[3] - 2
    bones = {"root": (OX, OY), "center": (OX, c["waist"]), "pelvis": (OX, c["pelvis"]),
             "torso": (OX, c["waist"]), "head": c["neck"]}
    parts = []  # (piece id, picture on the source canvas, bone, pivot, tint)

    def add(pid, pic, bone, tint=None, split=False):
        pivot = bones[bone]
        if split:
            a, b, rest = colour_split(pic)
            for sid, layer, t in ((f"{pid}_a", a, "primary"), (f"{pid}_b", b, "secondary"),
                                  (pid, rest, None)):
                if visible(layer):
                    parts.append((sid, layer, bone, pivot, t))
        elif visible(pic):
            parts.append((pid, pic, bone, pivot, tint))

    patches = c.get("patch", {})

    def patched(pid):
        if pid not in patches:
            return img
        p = img.copy()
        d = ImageDraw.Draw(p)
        for pts, rgb in patches[pid]:
            m = ImageChops.multiply(poly_mask(size, pts), img.getchannel("A"))
            d.bitmap((0, 0), m, fill=rgb + (255,))
        return p

    # Behind everything: what hangs on the back.
    for pid, pts in c.get("back", []):
        add(pid, cut(patched(pid), poly_mask(size, pts)), "torso", split=pid == "mantle")

    # Legs, turned straight about the ankle so the foot stays on the ground; the hip goes up
    # under the skirt, and the leg is drawn on up to it with its own part below the hem.
    for side in ("far", "near"):
        L = c["legs"][side]
        hip0, ankle = L["hip"], L["ankle"]
        hip = (ankle[0], ankle[1] - math.dist(hip0, ankle))
        knee = (ankle[0], (hip[1] + ankle[1]) / 2)
        leg = moved(cut(img, poly_mask(size, L["quad"])), upright(hip0, ankle), ankle, ankle)
        # The band copied upwards starts where the leg is whole, below the hem's slanted cut.
        solid = leg.getchannel("A").point(lambda v: 1 if v > 24 else 0)
        bb = solid.getbbox()
        widths = [solid.crop((0, y, size[0], y + 1)).histogram()[1] for y in range(bb[1], bb[3])]
        full = sorted(widths)[len(widths) // 2]
        top = bb[1] + next(i for i, wd in enumerate(widths) if wd >= full * 0.9) + 6
        band = leg.crop((0, top, size[0], min(top + 50, round(ankle[1]) - 10)))
        filled = Image.new("RGBA", size, (0, 0, 0, 0))
        y = top
        while y > hip[1] - 12:
            y -= band.height
            filled.alpha_composite(band, (0, y))
        filled.alpha_composite(leg)
        bones[f"thigh_{side}"] = hip
        bones[f"shin_{side}"] = knee
        bones[f"foot_{side}"] = ankle
        add(f"thigh_{side}", rows(filled, 0, knee[1] + OVER), f"thigh_{side}", split=True)
        add(f"shin_{side}", rows(filled, knee[1] - OVER, ankle[1] + OVER), f"shin_{side}",
            split=True)
        fx0, fy0, fx1 = L["foot"]
        foot = cut(img, poly_mask(size, [(fx0, fy0), (fx1, fy0), (fx1, size[1]), (fx0, size[1])]))
        if L["mirror"]:
            flipped = ImageOps.mirror(foot.crop((fx0, 0, fx1, size[1])))
            foot = Image.new("RGBA", size, (0, 0, 0, 0))
            foot.alpha_composite(flipped, (2 * ankle[0] - fx1, 0))
        add(f"foot_{side}", foot, f"foot_{side}", split=True)

    # Arms: upper arm turned straight about the shoulder, forearm and hand about the elbow, put
    # under it; the crozier's arm is kept as drawn.
    arm_pics = {}
    for side in ("far", "near"):
        A = c["arms"][side]
        s, e, w, h = A["shoulder"], A["elbow"], A["wrist"], A["hand"]
        if "parts" in A:
            bones[f"arm_{side}_upper"], bones[f"arm_{side}_lower"], bones[f"hand_{side}"] = s, e, h
            P = A["parts"]
            arm_pics[side] = [(f"arm_{side}_upper", cut(img, poly_mask(size, P["upper"]))),
                              (f"hand_{side}", cut(img, poly_mask(size, P["hand"])))]
            continue
        arm = cut(img, poly_mask(size, A["poly"]))
        e2 = below(s, e)
        w2 = below(e2, w, math.dist(e, w))
        h2 = below(w2, h, math.dist(w, h))
        up = moved(arm, upright(s, e), s, s)
        fore = moved(arm, upright(e, w), e, e2)
        bones[f"arm_{side}_upper"], bones[f"arm_{side}_lower"], bones[f"hand_{side}"] = s, e2, h2
        arm_pics[side] = [(f"arm_{side}_upper", rows(up, 0, e2[1] + OVER)),
                          (f"arm_{side}_lower", rows(fore, e2[1] - OVER, w2[1] + OVER)),
                          (f"hand_{side}", rows(fore, w2[1] - OVER, size[1]))]
        A["_moved"] = (w, w2)

    # The far arm and what its hand holds, behind the body.
    for pid, pts in c.get("hand_far_items", []):
        add(pid, cut(img, poly_mask(size, pts)), "hand_far")
    bone_of = {"arm_far_upper": "arm_far_upper", "arm_far_lower": "arm_far_lower",
               "hand_far": "hand_far", "arm_near_upper": "arm_near_upper",
               "arm_near_lower": "arm_near_lower", "hand_near": "hand_near"}
    for pid, pic in arm_pics["far"]:
        add(pid, pic, bone_of[pid], split=True)
    add("torso", cut(img, poly_mask(size, c["torso"])), "torso", split=True)
    for pid, pic in arm_pics["near"]:
        add(pid, pic, bone_of[pid], split=True)
    add("head", cut(img, poly_mask(size, c["head"])), "head", split=True)
    return OX, OY, bones, parts


def write(cls):
    OX, OY, bones, parts = build(cls)
    rig_path = ROOT / f"src/content/rigs/{cls}/rig.json"
    rig = json.loads(rig_path.read_text(encoding="utf8"))
    weapons = [p for p in rig["pieces"] if p.get("slot")]

    def rigp(p):
        return ((p[0] - OX) / S, (p[1] - OY) / S)

    new_bones = []
    for b in rig["bones"]:
        p = b["parent"]
        here = bones[b["id"]]
        there = bones[p] if p else (OX, OY)
        new_bones.append({"id": b["id"], "parent": p,
                          "x": round((here[0] - there[0]) / S, 2) if p else 0,
                          "y": round((here[1] - there[1]) / S, 2) if p else 0, "rot": 0})

    pieces, groups = [], []
    for pid, pic, bone, pivot, tint in parts:
        bb = pic.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        x0 = math.floor((bb[0] - OX) / S) * S + OX
        y0 = math.floor((bb[1] - OY) / S) * S + OY
        x1 = math.ceil((bb[2] - OX) / S) * S + OX
        y1 = math.ceil((bb[3] - OY) / S) * S + OY
        crop = pic.crop((x0, y0, x1, y1))
        w, h = (x1 - x0) // S, (y1 - y0) // S
        key = f"unit_{cls}_{pid}" + ("_tint" if tint else "")
        pieces.append({"id": pid, "bone": bone, "key": key, "size": [w, h],
                       "pivot": [round((pivot[0] - x0) / S, 2), round((pivot[1] - y0) / S, 2)],
                       "tint": tint})
        buf = io.BytesIO()
        crop.resize((max(1, round(crop.width * EMBED)), max(1, round(crop.height * EMBED))),
                    Image.LANCZOS).save(buf, "PNG", optimize=True)
        cx, cy = rigp((x0, y0))
        groups.append(f'  <g id="piece-{pid}">\n    <image x="{cx:g}" y="{cy:g}" width="{w}" '
                      f'height="{h}" href="data:image/png;base64,'
                      f'{base64.b64encode(buf.getvalue()).decode("ascii")}"/>\n  </g>')
    # The held weapons go in the near hand, after the near arm, before the head.
    at = next(i for i, p in enumerate(pieces) if p["id"].startswith("head"))
    pieces[at:at] = weapons
    rig["bones"] = new_bones
    rig["pieces"] = pieces
    rig_path.write_text(json.dumps(rig, indent=2) + "\n", encoding="utf8", newline="\n")
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<!--
  Medieverse: the {cls}, source of the rig's pieces (ASSETS §3.5, §9).
  Generated by assets/units/gen/cut_figure.py from gen/{cls}-source.png (2026-10-31), in the rig's
  frame (px x1, facing right, feet at (0, 0), y down), one group `piece-<id>` per piece of
  rig.json; the house's pieces are neutral greys (multiply tint). Do not edit by hand.
  © 2026 vynarim, all rights reserved (public/assets/LICENSE.md).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -90 80 94" width="320" height="376">
{chr(10).join(groups)}
</svg>
"""
    (ROOT / f"assets/units/{cls}/{cls}.svg").write_text(svg, encoding="utf8", newline="\n")
    print(cls, len(pieces), "pieces")


for name in sys.argv[1:] or list(CLASSES):
    write(name)
