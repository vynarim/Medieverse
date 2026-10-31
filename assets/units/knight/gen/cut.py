"""Cuts the generated knight (knight-source.png) into the pieces of its cutout rig (ASSETS §3.5).

The painting is the whole figure at rest, 16 source px to a rig px, soles at (600, 1313). Each
piece is masked out of it by a polygon (or a rectangle where the white ground parts the limbs),
the arms turned to hang straight down (the animations assume a straight arm at rest), the far foot
turned to face forward, the shoes repainted in umber and the house's pieces made neutral grey for
the multiply tint. Writes ../knight.svg (one group `piece-<id>` per piece, its picture embedded)
and the bones, sizes and pivots of src/content/rigs/knight/rig.json; `pnpm run art` then renders
the pieces at x2. Run from the repository root: python assets/units/knight/gen/cut.py
"""

import base64
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
RIG = ROOT / "src/content/rigs/knight/rig.json"
OUT_SVG = HERE.parent / "knight.svg"

S = 16  # source px per rig px
OX, OY = 600, 1313  # the soles, the rig's origin
EMBED = 4 / S  # the pictures are embedded at x4 (rig px): twice the x2 they are rendered at
INK = "#2a1d14"


def rig(p):
    return ((p[0] - OX) / S, (p[1] - OY) / S)


# The painting on a transparent ground: the white connected to the border goes.
src = Image.open(HERE / "knight-source.png").convert("RGB")
W, H = src.size
grey = src.convert("L").point(lambda v: 255 if v > 228 else 0)
ImageDraw.floodfill(grey, (0, 0), 128)
alpha = grey.point(lambda v: 0 if v == 128 else 255)
# The pale halo left round the ink line: pixels lighter than the paint next to the ground.
paint = src.copy()
paint.putalpha(alpha)


def poly_mask(points):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return m


def rect_mask(x0, y0, x1, y1):
    return poly_mask([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def turned(img, centre, deg):
    return img.rotate(deg, resample=Image.BICUBIC, center=centre)


class Piece:
    def __init__(self, pid, img, pivot_src, bone):
        """img: RGBA, the piece alone on the source canvas (after any turn); pivot in source px."""
        self.id = pid
        self.bone = bone
        box = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        # Whole rig px, so the rendered rectangle has no fraction.
        x0 = math.floor((box[0] - OX) / S) * S + OX
        y0 = math.floor((box[1] - OY) / S) * S + OY
        x1 = math.ceil((box[2] - OX) / S) * S + OX
        y1 = math.ceil((box[3] - OY) / S) * S + OY
        self.img = img.crop((x0, y0, x1, y1))
        self.corner = rig((x0, y0))
        self.size = [(x1 - x0) // S, (y1 - y0) // S]
        self.pivot = [round((pivot_src[0] - x0) / S, 2), round((pivot_src[1] - y0) / S, 2)]


def cut(mask, base=paint):
    out = base.copy()
    out.putalpha(ImageChops.multiply(base.getchannel("A"), mask))
    return out


def neutral(img):
    """Grey for the multiply tint (ASSETS §2): the paint's lightness, no hue."""
    a = img.getchannel("A")
    g = ImageOps.grayscale(img.convert("RGB")).convert("RGB")
    g.putalpha(a)
    return g


def umber(img):
    """The shoes, grey in the painting, in leather: umber shaded by the paint's lightness."""
    a = img.getchannel("A")
    lum = ImageOps.grayscale(img.convert("RGB"))
    rgb = Image.merge(
        "RGB",
        [lum.point(lambda v, c=c: v if v < 90 else min(255, round(c * v / 175))) for c in (0x8A, 0x5A, 0x34)],
    )
    rgb.putalpha(a)
    return rgb


pieces = {}
bones = {}  # world rest position (source px) of each bone's origin

bones["root"] = (OX, OY)
bones["center"] = (600, 775)
bones["pelvis"] = (600, 990)
bones["torso"] = (600, 775)
bones["head"] = (570, 468)

# Legs: the white parts them from each other; the skirt hides the hips, so the thighs are drawn
# on up under it with the mail of the leg below.
LEGS = {
    "far": dict(x=(338, 512), hip=(428, 990), knee=(425, 1140), ankle=(420, 1225), foot=(248, 492), mirror=True),
    "near": dict(x=(640, 782), hip=(708, 990), knee=(710, 1140), ankle=(712, 1225), foot=(640, 940), mirror=False),
}
for side, L in LEGS.items():
    bones[f"thigh_{side}"] = L["hip"]
    bones[f"shin_{side}"] = L["knee"]
    bones[f"foot_{side}"] = L["ankle"]
    x0, x1 = L["x"]
    filled = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    filled.alpha_composite(cut(rect_mask(x0, 1092, x1, 1182)).crop((x0, 1092, x1, 1182)), (x0, 1002))
    filled.alpha_composite(cut(rect_mask(x0, 1092, x1, 1162)))
    pieces[f"thigh_{side}"] = Piece(f"thigh_{side}", filled, L["hip"], f"thigh_{side}")
    pieces[f"shin_{side}"] = Piece(f"shin_{side}", cut(rect_mask(x0, 1120, x1, 1238)), L["knee"], f"shin_{side}")
    fx0, fx1 = L["foot"]
    foot = umber(cut(rect_mask(fx0, 1200, fx1, 1318)))
    if L["mirror"]:
        # It pointed backwards: turned about the ankle to face where the knight looks.
        ax = L["ankle"][0]
        flipped = ImageOps.mirror(foot.crop((fx0, 1200, fx1, 1318)))
        foot = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        foot.alpha_composite(flipped, (2 * ax - fx1, 1200))
    pieces[f"foot_{side}"] = Piece(f"foot_{side}", foot, L["ankle"], f"foot_{side}")

# Arms: one straight tube each, from the shoulder to the hand; turned to hang straight down, then
# parted at the elbow and the wrist, each part overlapping the next.
ARMS = {
    # The near arm (it holds the weapons) is the one behind, drawn over the tabard.
    "near": dict(
        shoulder=(425, 562),
        wrist=(272, 832),
        hand=40,
        poly=[(372, 515), (430, 512), (462, 545), (468, 600), (472, 652), (474, 700), (445, 708),
              (405, 740), (360, 790), (318, 830), (338, 875), (322, 912), (262, 928), (198, 930),
              (180, 885), (200, 830), (250, 735), (300, 645), (338, 575)],
    ),
    # The far arm, before the tabard, carries the shield.
    "far": dict(
        shoulder=(712, 556),
        wrist=(803, 836),
        hand=38,
        poly=[(690, 520), (722, 508), (760, 560), (802, 640), (842, 718), (858, 790), (862, 862),
              (852, 912), (790, 914), (778, 862), (768, 805), (748, 762), (726, 722), (712, 650),
              (702, 590)],
    ),
}
arm_ends = {}
for side, A in ARMS.items():
    sx, sy = A["shoulder"]
    dx, dy = A["wrist"][0] - sx, A["wrist"][1] - sy
    length = math.hypot(dx, dy)
    deg = -math.degrees(math.atan2(dx, dy))
    arm = turned(cut(poly_mask(A["poly"])), (sx, sy), deg)
    elbow = (sx, sy + length / 2)
    wrist = (sx, sy + length)
    hand = (sx, sy + length + A["hand"] * 0.6)
    over = 18
    top = sy - 200
    upper = cut(rect_mask(0, top, W, elbow[1] + over), arm)
    lower = cut(rect_mask(0, elbow[1] - over, W, wrist[1] + over), arm)
    fist = cut(rect_mask(0, wrist[1] - over, W, H), arm)
    bones[f"arm_{side}_upper"] = (sx, sy)
    bones[f"arm_{side}_lower"] = elbow
    bones[f"hand_{side}"] = hand
    pieces[f"arm_{side}_upper"] = Piece(f"arm_{side}_upper", upper, (sx, sy), f"arm_{side}_upper")
    pieces[f"arm_{side}_lower"] = Piece(f"arm_{side}_lower", lower, elbow, f"arm_{side}_lower")
    pieces[f"hand_{side}"] = Piece(f"hand_{side}", fist, hand, f"hand_{side}")
    arm_ends[side] = (A["wrist"], wrist)

# The shield keeps its place by the far hand, which hangs straighter now.
(w_old, w_new) = arm_ends["far"]
shift = (round(w_new[0] - w_old[0]), round(w_new[1] - w_old[1]))
SHIELD = [(832, 474), (872, 470), (1000, 556), (1052, 606), (1054, 700), (1034, 850), (988, 962),
          (946, 1066), (918, 1066), (868, 960), (828, 850), (806, 700), (810, 560)]
shield_img = neutral(cut(poly_mask(SHIELD)))
moved = Image.new("RGBA", (W, H), (0, 0, 0, 0))
moved.alpha_composite(shield_img, (0, 0))
moved = ImageChops.offset(moved, shift[0], shift[1])
pieces["shield"] = Piece("shield", moved, bones["arm_far_lower"], "arm_far_lower")

# Tabard, belt and buckle; the coif; the helm.
TORSO = [(398, 512), (470, 540), (560, 560), (650, 552), (718, 512), (708, 560), (714, 640),
         (722, 720), (730, 752), (738, 800), (760, 880), (790, 960), (818, 1050), (812, 1076),
         (700, 1084), (640, 1094), (560, 1096), (500, 1088), (440, 1080), (326, 1064), (334, 1030),
         (360, 960), (395, 880), (428, 812), (444, 760), (446, 712), (466, 704), (470, 650),
         (466, 590), (452, 548)]
pieces["torso"] = Piece("torso", neutral(cut(poly_mask(TORSO))), bones["torso"], "torso")
BELT = [(440, 742), (566, 742), (566, 812), (444, 808)], [(652, 742), (728, 742), (734, 806), (652, 812)]
belt = Image.new("L", (W, H), 0)
for b in BELT:
    ImageDraw.Draw(belt).polygon(b, fill=255)
pieces["belt"] = Piece("belt", neutral(cut(belt)), bones["torso"], "torso")
pieces["buckle"] = Piece("buckle", cut(rect_mask(562, 738, 656, 818)), bones["torso"], "torso")
NECK = [(372, 505), (390, 470), (410, 425), (500, 438), (600, 448), (700, 458), (728, 470),
        (730, 512), (705, 530), (650, 552), (560, 562), (470, 545), (400, 520)]
pieces["neck"] = Piece("neck", cut(poly_mask(NECK)), bones["torso"], "torso")
HELM = [(338, 92), (680, 18), (712, 40), (782, 470), (700, 472), (600, 460), (500, 450),
        (410, 438), (362, 425)]
pieces["helm"] = Piece("helm", cut(poly_mask(HELM)), bones["head"], "head")

# --- rig.json ---------------------------------------------------------------------------------
old = json.loads(RIG.read_text(encoding="utf8"))


# The held weapons, drawn in vector for the hand of the vector knight (rig px).
HAND_X, HAND_Y = 19, -37.5
old_hand = (HAND_X, HAND_Y)
new_bones = []
for b in old["bones"]:
    p = b["parent"]
    here = bones[b["id"]]
    there = bones[p] if p else (OX, OY)
    new_bones.append(
        {"id": b["id"], "parent": p, "x": round((here[0] - there[0]) / S, 2) if p else 0,
         "y": round((here[1] - there[1]) / S, 2) if p else 0, "rot": 0}
    )
new_hand = rig(bones["hand_near"])
dx, dy = new_hand[0] - old_hand[0], new_hand[1] - old_hand[1]

# Back to front: the shield behind the far arm, the far arm behind the tabard (its hand over the
# shield's rim), the near arm over the tabard, the coif and the helm over all.
ORDER = ["thigh_far", "shin_far", "foot_far", "thigh_near", "shin_near", "foot_near", "shield",
         "shield_charge", "arm_far_upper", "arm_far_lower", "hand_far", "torso", "belt", "buckle",
         "arm_near_upper", "arm_near_lower", "hand_near", "weapon_bow", "weapon_stone", "neck", "helm"]
by_id = {p["id"]: p for p in old["pieces"]}

# The charge on the shield (the 6.2 arms' place): a chevron in the tint's greys, its edge too.
sh = pieces["shield"]
sx0, sy0 = sh.corner
cw, chh = sh.size
charge_box = (sx0, sy0 + chh * 0.28, cw, chh * 0.34)

new_pieces = []
for pid in ORDER:
    p = dict(by_id[pid])
    if pid in pieces:
        pc = pieces[pid]
        p["bone"] = pc.bone
        p["size"] = pc.size
        p["pivot"] = pc.pivot
    elif pid == "shield_charge":
        bx, by_ = rig(bones["arm_far_lower"])
        p["size"] = [math.ceil(charge_box[2]), math.ceil(charge_box[3])]
        p["pivot"] = [round(bx - charge_box[0], 2), round(by_ - charge_box[1], 2)]
    else:
        # The held weapons keep their drawing, moved with the hand.
        pass
    new_pieces.append(p)
old["bones"] = new_bones
old["pieces"] = new_pieces
RIG.write_text(json.dumps(old, indent=2) + "\n", encoding="utf8", newline="\n")


# --- knight.svg -------------------------------------------------------------------------------
def embed(pc):
    w = max(1, round(pc.img.width * EMBED))
    h = max(1, round(pc.img.height * EMBED))
    buf = io.BytesIO()
    pc.img.resize((w, h), Image.LANCZOS).save(buf, "PNG", optimize=True)
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    x, y = pc.corner
    return (f'      <image x="{x:g}" y="{y:g}" width="{pc.size[0]}" height="{pc.size[1]}" '
            f'href="data:image/png;base64,{data}"/>')


weapons_svg = (HERE / "weapons.svg").read_text(encoding="utf8")


def weapon_group(pid):
    start = weapons_svg.index(f'<g id="piece-{pid}">')
    end = weapons_svg.index("</g>", start) + 4
    return weapons_svg[start:end]


# The shield's outline, for the chevron's clip (rig px, after the move).
clip = " ".join(f"{(x + shift[0] - OX) / S:.2f},{(y + shift[1] - OY) / S:.2f}" for x, y in SHIELD)
cx, cy, cw2, ch2 = charge_box
apex = (cx + cw2 * 0.55, cy)
left_low = (cx - 2, cy + ch2 * 0.75)
right_low = (cx + cw2 + 2, cy + ch2 * 0.55)
band = ch2 * 0.42
chevron = (f"M{left_low[0]:.2f} {left_low[1]:.2f} L{apex[0]:.2f} {apex[1]:.2f} "
           f"L{right_low[0]:.2f} {right_low[1]:.2f} L{right_low[0]:.2f} {right_low[1] + band:.2f} "
           f"L{apex[0]:.2f} {apex[1] + band:.2f} L{left_low[0]:.2f} {left_low[1] + band:.2f} Z")

parts = []
for pid in ORDER:
    if pid in pieces:
        parts.append(f'    <g id="piece-{pid}">\n{embed(pieces[pid])}\n    </g>')
    elif pid == "shield_charge":
        parts.append(
            f'    <g id="piece-shield_charge" clip-path="url(#shield-rim)">\n'
            f'      <path d="{chevron}" fill="#c4c4c4" stroke="#262626" stroke-width="0.9" '
            f'stroke-linejoin="round"/>\n    </g>'
        )
    else:
        g = weapon_group(pid).replace(
            f'<g id="piece-{pid}">', f'<g id="piece-{pid}" transform="translate({dx:.2f} {dy:.2f})">'
        )
        parts.append("    " + g)

svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<!--
  Medieverse: the knight, source of the rig's pieces (ASSETS §3.5, §9).
  Generated by assets/units/knight/gen/cut.py from the painting gen/knight-source.png (2026-10-31):
  each piece cut out of it, in the rig's own frame (px x1, facing right, feet at (0, 0), y down),
  one group `piece-<id>` per piece of rig.json. Pieces tinted to the house's colours are neutral
  greys (multiply tint, ASSETS §2). The held weapons are still drawn in vector. Do not edit by hand:
  change cut.py and run it again, then `pnpm run art`.
  © 2026 vynarim, all rights reserved (public/assets/LICENSE.md).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -90 80 94" width="320" height="376">
  <defs>
    <clipPath id="shield-rim"><polygon points="{clip}"/></clipPath>
  </defs>
  <g stroke="{INK}" stroke-linejoin="round" stroke-linecap="round">
{chr(10).join(parts)}
  </g>
</svg>
"""
OUT_SVG.write_text(svg, encoding="utf8", newline="\n")
print("pieces:", {k: (v.size, v.pivot) for k, v in pieces.items()})
print("hand moved by", round(dx, 2), round(dy, 2), "shield shift", shift)
