#!/usr/bin/env python3
"""Cut the approved mascot stills into a Rive rig for the "Coach" mascot.

    python3 scripts/mascot-coach-layers.py      (from apps/web)

Reads public/brand-mascot-{wave,celebrate}-cartoon.png (production art, untouched) and writes
public/mascot-layers/coach/<pose>/<part>.png plus public/mascot-layers/coach/rig.json, which
scripts/mascot-coach-build.mjs turns into the .riv.

How the cut works
- Fill regions are the connected areas between the navy contour lines. Each part claims its
  regions by seed points; small islands go to the nearest part.
- Contour pixels belong to the front-most part whose fill is within LINE_R px (a line between the
  head and an ear is the head's outline, so the ear can turn behind it without losing it).
- Two joins have no contour (right ear into the head, right arm into the torso); a split polygon
  cuts those just outside the front part's line.
- Every part that sits behind another is extended under it with its own nearest fill colour,
  so rotations reveal fur, never holes or background.
- Eyes become a rig: the head keeps a white sclera, the iris/pupil/highlight and the upper lash
  line become separate images, and rig.json carries each eye's clip polygon for lids.
Colours are "deepened" exactly like apps/mobile/scripts/build-mascot-rig.py so Rive and the
sprite fallback show the same antelope. Images are exported at EXPORT_SCALE and drawn at 1/scale.
"""

import json
import math
import os
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/mascot-layers/coach"
LINE_R = 10
EXPORT_SCALE = 0.62


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def deepen(a):
    a = a.astype(np.float64).copy()
    a[:, :, :3] = np.round(srgb_to_linear(a[:, :, :3] / 255.0) * 255.0)
    return a.astype(np.uint8)


def poly_mask(shape, pts):
    im = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
    return np.asarray(im) > 0


def dilate(m, r):
    if r <= 0:
        return m.copy()
    im = Image.fromarray(m.astype(np.uint8) * 255)
    # MaxFilter needs an odd size; big radii are done in steps to stay fast
    out = im
    left = r
    while left > 0:
        step = min(left, 6)
        out = out.filter(ImageFilter.MaxFilter(step * 2 + 1))
        left -= step
    return np.asarray(out) > 0


def label(fill):
    H, W = fill.shape
    lab = np.zeros((H, W), np.int32)
    n = 0
    for y in range(H):
        for x in np.nonzero(fill[y] & (lab[y] == 0))[0]:
            if lab[y, x]:
                continue
            n += 1
            q = deque([(y, x)])
            lab[y, x] = n
            while q:
                cy, cx = q.popleft()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < H and 0 <= nx < W and fill[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        q.append((ny, nx))
    return lab, n


def grow(owner, op, order, steps=200):
    """Assign unowned opaque pixels to the nearest owned neighbour (4-neighbour BFS rings)."""
    for _ in range(steps):
        un = op & (owner < 0)
        if not un.any():
            break
        for k in order:
            m = owner == k
            nb = np.zeros_like(m)
            nb[1:] |= m[:-1]
            nb[:-1] |= m[1:]
            nb[:, 1:] |= m[:, :-1]
            nb[:, :-1] |= m[:, 1:]
            owner[nb & un & (owner < 0)] = k
    return owner


def extend_colors(rgba, src_mask, target, iters=80):
    """Push src_mask colours outward into target (nearest-colour inpaint, no contour lines)."""
    rgba = rgba.copy()
    have = src_mask.copy()
    want = target & ~have
    for _ in range(iters):
        if not want.any():
            break
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            shifted = np.roll(np.roll(have, dy, 0), dx, 1)
            take = want & shifted
            if take.any():
                ys, xs = np.nonzero(take)
                rgba[ys, xs] = rgba[(ys - dy) % rgba.shape[0], (xs - dx) % rgba.shape[1]]
                rgba[ys, xs, 3] = 255
                have |= take
                want &= ~take
    return rgba


def fill_holes(m):
    """Mask plus everything it encloses."""
    H, W = m.shape
    outside = np.zeros_like(m)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if not m[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if not m[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < H and 0 <= nx < W and not m[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
    return ~outside


def largest(m):
    lab, n = label(m)
    if n == 0:
        return m
    sizes = np.bincount(lab.ravel())[1:]
    return lab == (1 + int(np.argmax(sizes)))


def radial_polygon(m, n=40, grow_px=1.5):
    ys, xs = np.nonzero(m)
    cx, cy = xs.mean(), ys.mean()
    pts = []
    H, W = m.shape
    for i in range(n):
        a = 2 * math.pi * i / n
        dx, dy = math.cos(a), math.sin(a)
        r = 0.0
        last = 0.0
        while r < 400:
            x, y = int(round(cx + dx * r)), int(round(cy + dy * r))
            if not (0 <= x < W and 0 <= y < H):
                break
            if m[y, x]:
                last = r
            r += 0.5
        pts.append([round(cx + dx * (last + grow_px), 1), round(cy + dy * (last + grow_px), 1)])
    return [round(cx, 1), round(cy, 1)], pts


# ---------------------------------------------------------------- pose configs
# z-order back -> front. seeds: fill points; force: polygons whose dark pixels go to the part;
# split: polygons that move pixels of `from` into this part; under: parts this one extends beneath.
WAVE = {
    "src": "brand-mascot-wave-cartoon.png",
    "parts": [
        {"id": "tail", "seeds": [(442, 818)], "force": [[(448, 785), (520, 785), (520, 862), (448, 862)]],
         "under": {"body": 22}, "pivot": (436, 806)},
        {"id": "body", "seeds": [(330, 760), (250, 900), (390, 900)], "under": {"armR": 26, "armL": 34, "head": 0, "neck": 0},
         "pivot": (330, 948)},
        {"id": "armR", "seeds": [], "split": {"from": "body", "poly": [(352, 598), (480, 598), (565, 690), (565, 795),
                                                                     (470, 795), (432, 724), (389, 668), (364, 628)]},
         "force": [[(462, 690), (548, 690), (548, 785), (462, 785)]], "under": {"neck": 30}, "pivot": (402, 628)},
        # the raised arm is tucked behind the cheek: rebuild it as a tube with its own inner outline
        {"id": "armL", "seeds": [(160, 540)], "force": [[(38, 412), (126, 412), (134, 492), (38, 492)]],
         "tube": {"p0": (67, 490), "p1": (212, 632), "width": 62}, "under": {"neck": 34}, "pivot": (232, 640),
         # cut-out segments (rigid pieces with round joint caps; a skinned mesh renders with jaggies)
         "segments": {"elbow": (163, 552), "wrist": (110, 478), "radius": 31}},
        # ears pivot near the lower junction (perking up then never opens a gap there); ink joints
        # close the wedge at either junction while an ear flops
        {"id": "earL", "seeds": [(90, 250), (142, 232)], "under": {"head": 40}, "ext_disk": 62, "ext_center": (155, 273),
         "joints": [(132, 313, 11, "head"), (178, 234, 11, "head")], "pivot": (137, 305)},
        {"id": "earR", "seeds": [(577, 266)], "split": {"from": "head", "poly": [(482, 170), (672, 170), (672, 352), (515, 352),
                                                                               (506, 298), (494, 270), (482, 243)]},
         "under": {"head": 40}, "ext_disk": 62, "ext_center": (504, 286),
         "joints": [(521, 326, 11, "head"), (487, 247, 11, "head")], "pivot": (516, 318)},
        {"id": "head", "seeds": [(330, 300), (312, 541)],
         "force": [[(121, 380), (146, 380), (148, 468), (124, 468)],
                   [(168, 30), (252, 22), (258, 70), (228, 120), (232, 170), (250, 212), (246, 240), (196, 240), (174, 190), (164, 110)],
                   [(432, 30), (500, 34), (512, 120), (500, 205), (476, 248), (424, 244), (448, 182), (452, 110)]],
         "under": {"neck": 26}, "pivot": (322, 586)},
        {"id": "neck", "line_r": 4, "seeds": [(300, 620), (443, 563), (440, 605), (412, 578)],
         "force": [[(214, 552), (262, 563), (330, 574), (400, 565), (430, 552), (482, 545), (482, 625), (300, 690), (214, 600)]],
         "pivot": (318, 566)},
    ],
    "eyes": [{"id": "eyeL", "box": (158, 318, 290, 474)}, {"id": "eyeR", "box": (342, 318, 480, 478)}],
}

CELEBRATE = {
    "src": "brand-mascot-celebrate-cartoon.png",
    "parts": [
        {"id": "tail", "seeds": [(478, 720)], "force": [[(468, 640), (545, 640), (545, 745), (468, 745)]],
         "under": {"body": 22}, "pivot": (458, 726)},
        {"id": "body", "seeds": [(330, 730), (200, 790), (420, 800)], "under": {"armL": 30, "armR": 30, "head": 0, "neck": 0},
         "pivot": (330, 880)},
        {"id": "armL", "seeds": [(130, 481)], "force": [[(25, 340), (105, 340), (105, 412), (25, 412)]],
         "under": {"head": 34, "neck": 30}, "pivot": (205, 560)},
        {"id": "armR", "seeds": [(509, 522)], "force": [[(575, 385), (660, 385), (660, 470), (575, 470)]],
         "under": {"neck": 30, "head": 30}, "pivot": (418, 594)},
        {"id": "earL", "seeds": [(123, 235), (174, 221)], "under": {"head": 40}, "ext_disk": 62, "ext_center": (180, 260),
         "joints": [(152, 299, 11, "head"), (207, 222, 11, "head")], "pivot": (157, 292)},
        {"id": "earR", "seeds": [(598, 297)], "split": {"from": "head", "poly": [(503, 196), (703, 196), (703, 382), (540, 382),
                                                                               (528, 322), (519, 292), (503, 247)]},
         "under": {"head": 40}, "ext_disk": 62, "ext_center": (525, 310),
         "joints": [(536, 353, 11, "head"), (515, 268, 11, "head")], "pivot": (531, 345)},
        {"id": "head", "seeds": [(345, 375), (291, 532)],
         "force": [[(214, 70), (300, 30), (322, 52), (282, 110), (280, 175), (300, 222), (282, 250), (232, 240), (214, 160)],
                   [(482, 60), (540, 50), (556, 140), (535, 222), (500, 262), (446, 250), (480, 196), (492, 120)]],
         "under": {"neck": 26}, "pivot": (332, 566)},
        {"id": "neck", "line_r": 4, "seeds": [(290, 600), (411, 571), (398, 609)],
         "force": [[(208, 560), (262, 572), (330, 582), (400, 574), (445, 556), (445, 630), (265, 666), (208, 610)]],
         "pivot": (318, 566)},
    ],
    "eyes": [{"id": "eyeL", "box": (150, 290, 290, 450)}, {"id": "eyeR", "box": (345, 330, 485, 490)}],
}


def build_pose(name, cfg):
    A = np.array(Image.open(ROOT / "public" / cfg["src"]).convert("RGBA"))
    H, W = A.shape[:2]
    op = A[:, :, 3] > 127
    dark = op & (A[:, :, :3].max(2) < 100)
    fill = op & ~dark
    lab, _ = label(fill)
    parts = cfg["parts"]
    ids = [p["id"] for p in parts]
    owner = np.full((H, W), -1, np.int32)
    # 1. fill regions by seed
    for k, p in enumerate(parts):
        for x, y in p["seeds"]:
            l = lab[y, x]
            if not l:  # nudge onto the nearest fill pixel
                win = lab[y - 6 : y + 7, x - 6 : x + 7]
                l = int(win.max())
            assert l > 0, f"{name}/{p['id']}: seed {x},{y} is not on a fill region"
            owner[lab == l] = k
    # 1b. contour-less joins: move the front part's *fill* inside the split polygon (lines are
    # sorted out below, now that both fills are known)
    for k, p in enumerate(parts):
        if "split" in p:
            src = ids.index(p["split"]["from"])
            owner[(owner == src) & fill & poly_mask((H, W), p["split"]["poly"])] = k
    # 2. forced dark regions
    for k, p in enumerate(parts):
        for poly in p.get("force", []):
            owner[poly_mask((H, W), poly) & dark & (owner < 0)] = k
    # 3. contour lines (plus tiny antialias slivers along them): front-most part within LINE_R
    sizes = np.bincount(lab.ravel())
    sliver = fill & (sizes[lab] < 40)
    for k in reversed(range(len(parts))):
        near = dilate(owner == k, parts[k].get("line_r", LINE_R))
        owner[near & (dark | sliver) & (owner < 0)] = k
    # 4. everything else (islands, thick dark fills) to nearest
    owner = grow(owner, op, list(reversed(range(len(parts)))))
    masks = {p["id"]: owner == k for k, p in enumerate(parts)}

    layers = {}
    for k, p in enumerate(parts):
        m = masks[p["id"]]
        rgba = np.zeros_like(A)
        rgba[m] = A[m]
        # clean sources only: flat fill away from contour antialiasing, so extensions stay flat fur
        srcfill = m & ~dark & ~dilate(dark, 3)
        horns = np.zeros((H, W), bool)
        for poly in next(q for q in parts if q["id"] == "head").get("force", [])[1:]:
            horns |= dilate(poly_mask((H, W), poly), 6)
        for other, r in p.get("under", {}).items():
            target = masks[other] if r == 0 else (dilate(m, r) & masks[other] & ~horns)
            if other == "head" and p["id"] == "body":
                # neck: fur under the lower half of the head only
                target = masks["head"] & poly_mask((H, W), [(200, 470), (460, 470), (460, 620), (200, 620)])
            if r == 0 and other == "neck":
                target = masks["neck"]
            if "ext_disk" in p:
                # keep hidden extensions near the pivot and well inside the cover, so a big
                # rotation never swings them out past the cover's silhouette
                yy, xx = np.mgrid[0:H, 0:W]
                px, py = p.get("ext_center", p["pivot"])
                disk = (xx - px) ** 2 + (yy - py) ** 2 <= p["ext_disk"] ** 2
                target = target & disk & ~dilate(~op, 14)
            rgba = extend_colors(rgba, srcfill, target)
            m = m | target
        if "tube" in p:
            rgba = add_tube(rgba, m, srcfill, p["tube"], dark)
        # contour joints: ink discs where this part's outline dives under its cover. Hidden at rest
        # (only painted under the cover); when the part rotates they close the wedge between outlines.
        for jx, jy, jr, cover in p.get("joints", []):
            yy, xx = np.mgrid[0:H, 0:W]
            disc = ((xx - jx) ** 2 + (yy - jy) ** 2 <= jr * jr) & masks[cover] & ~(m & ~dark)
            rgba[disc] = (2, 17, 44, 255)
        layers[p["id"]] = rgba
        if "segments" in p:
            for k2, v2 in split_limb(rgba, dark, p["pivot"], p["segments"]).items():
                layers[f'{p["id"]}{k2}'] = v2
            del layers[p["id"]]

    # eyes: sclera fill on the head, iris + lash as their own images, clip polygons
    eyes_meta = []
    head = layers["head"]
    # the upper lid is fur, sampled on the forehead above the eyes (as the sprite rig's blink
    # frames are; a cream one closed as a pale disk), the lower lid is the cream cheek pushing up
    ex = [(e["box"][0] + e["box"][2]) / 2 for e in cfg["eyes"]]
    ey = [(e["box"][1] + e["box"][3]) / 2 for e in cfg["eyes"]]
    mx, my = int(sum(ex) / len(ex)), int(sum(ey) / len(ey))
    fur = np.median(np.array([A[my - 90, mx + dx] for dx in (-30, 0, 30)]), 0).astype(np.uint8)
    lid = [int(v) for v in deepen(fur.reshape(1, 1, 4))[0, 0][:3]]
    cheek = [int(v) for v in deepen(np.array([[[254, 237, 208, 255]]], np.uint8))[0, 0][:3]]
    for e in cfg["eyes"]:
        x0, y0, x1, y1 = e["box"]
        box = np.zeros((H, W), bool)
        box[y0:y1, x0:x1] = True
        r, g, b = (A[:, :, i].astype(int) for i in range(3))
        white = box & op & (r > 232) & (g > 232) & (b > 220)
        brown = box & op & (r > 90) & (r < 215) & (g > 50) & (g < 160) & (b < 120) & (r > g + 20) & (g > b)
        # sclera = the big white region; pupil = biggest dark blob after an opening (cuts it free of
        # a touching lash line); lash = the dark line hugging the sclera; iris = whatever the eye
        # encloses besides those (brown ring, pupil, highlights)
        sclera = largest(white)
        core = largest(~dilate(~(box & dark), 7))
        pupil = dilate(core, 8) & dark & box
        lash = largest(box & dark & ~dilate(pupil, 1) & dilate(sclera, 7))
        clip = fill_holes(sclera | lash | pupil | (brown & dilate(sclera | pupil, 6)))
        iris = clip & ~sclera & ~lash
        center, poly = radial_polygon(clip, 44, 1.0)
        white_px = A[sclera].mean(0).astype(np.uint8)
        ring = dilate(clip, 8) & ~clip & op & ~dark
        cream_px = np.median(A[ring], 0).astype(np.uint8) if ring.any() else white_px
        head[clip] = white_px
        iris_img = np.zeros_like(A)
        iris_img[iris] = A[iris]
        lash_img = np.zeros_like(A)
        lash_img[lash] = A[lash]
        layers[e["id"] + "Iris"] = iris_img
        layers[e["id"] + "Lash"] = lash_img
        ys, xs = np.nonzero(clip)
        eyes_meta.append({
            "id": e["id"], "center": center, "clip": poly,
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
            "iris": bbox_of(iris), "lid": lid, "lidLo": cheek,
        })

    # export
    pose_dir = OUT / name
    pose_dir.mkdir(parents=True, exist_ok=True)
    for old in pose_dir.glob("*.png"):
        old.unlink()
    meta = {"width": W, "height": H, "scale": EXPORT_SCALE, "parts": {}, "eyes": eyes_meta}
    for pid, rgba in layers.items():
        rgba = defringe(rgba)
        rgba = deepen(rgba)
        bb = bbox_of(rgba[:, :, 3] > 0, pad=2)
        if bb is None:
            continue
        # bleed colour into the transparent margin so downscaled (premultiplied) edges and cut
        # seams don't pick up black or white fringes
        bled = extend_colors(rgba, rgba[:, :, 3] > 0, dilate(rgba[:, :, 3] > 0, 4), iters=4)
        bled[:, :, 3] = rgba[:, :, 3]
        crop = Image.fromarray(bled).crop(bb)
        w = max(1, round(crop.width * EXPORT_SCALE))
        h = max(1, round(crop.height * EXPORT_SCALE))
        small = crop.resize((w, h), Image.LANCZOS)
        # always truecolor RGBA: Rive's iOS decoder drew palette PNGs' transparent margins as solid
        # paint (a white band over the left of the face), and palette entries tint cut seams
        small.save(pose_dir / f"{pid}.png", optimize=True)
        cfgp = next((p for p in parts if p["id"] == pid or ("segments" in p and pid.startswith(p["id"]))), None)
        meta["parts"][pid] = {
            "file": f"mascot-layers/coach/{name}/{pid}.png",
            "bbox": bb,
            "center": [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2],
            "pivot": list(cfgp["pivot"]) if cfgp else None,
        }
    # composite check (rest pose, eyes as-is) against the deepened original
    comp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    order = []
    for q in parts:
        if q["id"] == "neck":
            continue
        order += [q["id"] + k for k in ("Fore", "Hoof", "Upper")] if "segments" in q else [q["id"]]
    eye_ids = [k for e in cfg["eyes"] for k in (e["id"] + "Iris", e["id"] + "Lash")]
    for pid in order[: order.index("head") + 1] + eye_ids + ["neck"]:
        comp.alpha_composite(Image.fromarray(deepen(layers[pid])))
    ref = Image.fromarray(deepen(A))
    diff = np.abs(np.asarray(comp).astype(int) - np.asarray(ref).astype(int)).max(2)
    bad = (diff > 40) & op
    print(f"{name}: {len(layers)} layers, composite mismatch {bad.sum()} px of {op.sum()}")
    if os.environ.get("COACH_DEBUG"):
        dbg = np.asarray(comp.convert("RGB")).copy()
        dbg[bad] = (255, 0, 255)
        Image.fromarray(dbg).save(OUT / f"{name}-composite-check.png")
    return meta


def add_tube(rgba, visible, srcfill, t, dark):
    """Continue a limb under whatever covers it as a straight tube with a fresh inner contour."""
    H, W = visible.shape
    p0, p1 = np.array(t["p0"], float), np.array(t["p1"], float)
    d = (p1 - p0) / np.linalg.norm(p1 - p0)
    n = np.array([d[1], -d[0]])
    q0, q1 = p0 + n * t["width"], p1 + n * t["width"]
    tube = poly_mask((H, W), [tuple(p0), tuple(p1), tuple(q1), tuple(q0)])
    # refill the tube (and the antialiased rim next to the old cover) from clean fill colour
    target = tube & ~srcfill & ~(visible & dark)
    rgba = extend_colors(rgba, srcfill, target)
    # inner outline, only where it is not over the visible drawing
    line = Image.new("L", (W, H), 0)
    ImageDraw.Draw(line).line([tuple(q0), tuple(q1)], fill=255, width=9)
    lm = (np.asarray(line) > 0) & ~(visible & ~dark)
    rgba[lm] = (2, 17, 44, 255)
    return rgba


def defringe(rgba, passes=1):
    """Drop near-white edge pixels that touch transparency (matting left over from a white page).
    Mid-grey antialiasing on dark outlines stays, or the edges go jagged."""
    rgba = rgba.copy()
    for _ in range(passes):
        a = rgba[:, :, 3] > 0
        c = rgba[:, :, :3].astype(int)
        pale = (c.min(2) > 212) & (c.max(2) - c.min(2) < 40)
        edge = a & dilate(~a, 1)
        rgba[pale & edge, 3] = 0
    return rgba


def split_limb(rgba, dark, shoulder, seg):
    """Cut a limb into Upper / Fore / Hoof pieces. Fore gets a round cap under Upper's end and is
    extended under the hoof, so bending either joint shows fur and outline, never a gap."""
    H, W = dark.shape
    S, Ej, Wj = (np.array(v, float) for v in (shoulder, seg["elbow"], seg["wrist"]))
    d = (Wj - S) / np.linalg.norm(Wj - S)
    yy, xx = np.mgrid[0:H, 0:W]
    t = (xx - S[0]) * d[0] + (yy - S[1]) * d[1]
    have = rgba[:, :, 3] > 0
    tE = (Ej - S) @ d
    # hoof = the dark blob at the end of the limb (beyond the wrist)
    hoof = largest(have & dark & (t > (Wj - S) @ d - 12))
    hoof = fill_holes(dilate(hoof, 2)) & have  # with its antialiased rim
    upper = have & (t < tE) & ~hoof
    fore = have & (t >= tE) & ~hoof
    out = {}
    up = np.zeros_like(rgba); up[upper] = rgba[upper]
    # feather the upper piece 7 px past the cut over the (identical) forearm drawing, so the joint
    # has no hard edge for the renderer to antialias into a seam
    ramp = have & ~hoof & (t >= tE) & (t < tE + 7)
    up[ramp] = rgba[ramp]
    up[ramp, 3] = (rgba[ramp, 3] * np.clip(1 - (t[ramp] - tE) / 7, 0, 1)).astype(np.uint8)
    fo = np.zeros_like(rgba); fo[fore] = rgba[fore]
    ho = np.zeros_like(rgba); ho[hoof] = rgba[hoof]
    r = seg["radius"]
    cap = ((xx - Ej[0]) ** 2 + (yy - Ej[1]) ** 2 <= r * r)
    ring = cap & ~((xx - Ej[0]) ** 2 + (yy - Ej[1]) ** 2 <= (r - 8) ** 2)
    clean = fore & ~dark & ~dilate(dark, 3)
    # under the hoof, continue only the forearm tube (a band around the limb axis), so a turning
    # hoof never uncovers fur outside the arm's silhouette
    n = np.array([d[1], -d[0]])
    band = (np.abs((xx - S[0]) * n[0] + (yy - S[1]) * n[1]) <= r - 4) & (t <= (Wj - S) @ d + 26)
    fo = extend_colors(fo, clean, ((cap | (hoof & band)) & ~fore) | (fore & ~dark & ~clean))
    # outline the cap where it is not over the forearm's own drawing
    fo[ring & ~fore] = (2, 17, 44, 255)
    out["Upper"], out["Fore"], out["Hoof"] = up, fo, ho
    return out


def bbox_of(m, pad=0):
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return None
    H, W = m.shape
    return [max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad), min(W, int(xs.max()) + 1 + pad), min(H, int(ys.max()) + 1 + pad)]


def main():
    rig = {"wave": build_pose("wave", WAVE), "celebrate": build_pose("celebrate", CELEBRATE)}
    (OUT / "rig.json").write_text(json.dumps(rig, indent=1))
    # residue cleanup + the one-piece raised arm (see mascot_cleanup.py)
    from mascot_cleanup import run as cleanup

    cleanup(OUT.parents[2])
    total = sum(f.stat().st_size for f in OUT.rglob("*.png") if "check" not in f.name)
    print("wrote", OUT / "rig.json", f"layers {total // 1024} KB")


if __name__ == "__main__":
    main()
