#!/usr/bin/env python3
"""Build the mobile mascot rig from the layered artwork.

    python3 apps/mobile/scripts/build-mascot-rig.py

Outputs to apps/mobile/assets/mascot/rig/ and writes src/components/mascot/rig.generated.ts
with every layer's frame in source-pixel space. Colours are "deepened" exactly like
apps/web/scripts/mascot-deepen.py so the app antelope matches the landing page.

Blinks are hand-drawn style frames (lid at 45%, 80%, closed) rather than a
runtime mask: Expo Go can't clip to arbitrary shapes cheaply, and three-frame
blinks are the classic 2D-animation read anyway.
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/mascot"
OUT = SRC / "rig"
TS = ROOT / "src/components/mascot/rig.generated.ts"
OUT.mkdir(exist_ok=True)

BLINK_STEPS = [0.45, 0.8, 1.0]
SS = 4  # supersample for lid strokes


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def deepen(a: np.ndarray) -> np.ndarray:
    a = a.astype(np.float64).copy()
    a[:, :, :3] = np.round(srgb_to_linear(a[:, :, :3] / 255.0) * 255.0)
    return a.astype(np.uint8)


def load(p: Path) -> np.ndarray:
    return np.array(Image.open(p).convert("RGBA"))


def over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    d = Image.fromarray(dst)
    d.alpha_composite(Image.fromarray(src))
    return np.array(d)


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    return np.asarray(im.filter(ImageFilter.MaxFilter(r * 2 + 1))) > 0


def erode(mask: np.ndarray, r: int) -> np.ndarray:
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    return np.asarray(im.filter(ImageFilter.MinFilter(r * 2 + 1))) > 0


def bbox(mask: np.ndarray, pad: int = 0):
    ys, xs = np.nonzero(mask)
    h, w = mask.shape
    return (
        max(int(xs.min()) - pad, 0),
        max(int(ys.min()) - pad, 0),
        min(int(xs.max()) + 1 + pad, w),
        min(int(ys.max()) + 1 + pad, h),
    )


def save(a: np.ndarray, name: str, box=None):
    im = Image.fromarray(a)
    if box:
        im = im.crop(box)
    im.save(OUT / name, optimize=True)
    return box


def components(mask: np.ndarray):
    """Split a mask into connected blobs, left to right (tiny flood fill)."""
    seen = np.zeros_like(mask, bool)
    blobs = []
    h, w = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        pts = []
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(pts) > 200:
            b = np.zeros_like(mask)
            ys, xs = zip(*pts)
            b[list(ys), list(xs)] = True
            blobs.append(b)
    blobs.sort(key=lambda b: np.nonzero(b)[1].mean())
    return blobs


def lid_frames(base: np.ndarray, eyes: list[np.ndarray], fur, ink, stroke: float):
    """Return [(rgba, box)] for each blink step; lids are drawn per eye."""
    union = np.zeros(base.shape[:2], bool)
    for e in eyes:
        union |= e
    box = bbox(union, pad=8)
    x0, y0, x1, y1 = box
    frames = []
    for p in BLINK_STEPS:
        W, H = (x1 - x0) * SS, (y1 - y0) * SS
        fill = Image.new("L", (W, H), 0)
        line = Image.new("L", (W, H), 0)
        fd, ld = ImageDraw.Draw(fill), ImageDraw.Draw(line)
        for e in eyes:
            ex0, ey0, ex1, ey1 = bbox(e)
            cx, w, h = (ex0 + ex1) / 2, ex1 - ex0, ey1 - ey0
            pts = []
            for i in range(41):
                u = -1 + i / 20
                x = cx + u * w * 0.62
                if p >= 1.0:
                    # closed: relaxed arc, a touch below centre
                    y = ey0 + h * (0.5 + 0.13 * (1 - u * u))
                else:
                    y = ey0 + h * p + h * 0.16 * p * (1 - u * u)
                pts.append(((x - x0) * SS, (y - y0) * SS))
            if p >= 1.0:
                fd.rectangle((0, 0, W, H), fill=255)
            else:
                poly = [(pts[0][0], -10)] + pts + [(pts[-1][0], -10)]
                fd.polygon(poly, fill=255)
            ld.line(pts, fill=255, width=int(stroke * SS), joint="curve")
            r = stroke * SS / 2
            for (px, py) in (pts[0], pts[-1]):
                ld.ellipse((px - r, py - r, px + r, py + r), fill=255)
        fill = np.asarray(fill.resize((x1 - x0, y1 - y0), Image.LANCZOS)) / 255.0
        line = np.asarray(line.resize((x1 - x0, y1 - y0), Image.LANCZOS)) / 255.0
        clip = union[y0:y1, x0:x1].astype(float)
        soft = np.asarray(Image.fromarray((clip * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))) / 255.0
        clip_line = erode(union, 3)[y0:y1, x0:x1].astype(float)
        a_fill = np.clip(fill * soft, 0, 1)
        a_line = np.clip(line * clip_line, 0, 1)
        rgb = np.zeros((y1 - y0, x1 - x0, 3))
        rgb[:] = fur
        rgb = rgb * (1 - a_line[..., None]) + np.array(ink) * a_line[..., None]
        alpha = np.clip(a_fill + a_line, 0, 1)
        out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
        frames.append((out, box))
    return frames


def sample(a: np.ndarray, pts):
    return tuple(int(v) for v in np.median(np.array([a[y, x, :3] for x, y in pts]), axis=0))


def main():
    rig: dict[str, dict] = {}

    # ---------------- wave ----------------
    # Built from the Rive coach's cleaned layers (apps/web/scripts/mascot-coach-layers.py and
    # mascot_cleanup.py), so both mascots share one cut: the one-piece raised arm, and a face
    # with its full outline. Back (behind the arm) and front (head, ears, scarf) are separate
    # images, so the arm sits between them as it does in Rive. Those layers are already deepened.
    W, H = 674, 978
    coach = ROOT.parent / "web/public"
    parts = json.loads((coach / "mascot-layers/coach/rig.json").read_text())["wave"]["parts"]

    def part(n: str) -> np.ndarray:
        x0, y0, x1, y1 = parts[n]["bbox"]
        im = Image.open(coach / parts[n]["file"]).convert("RGBA").resize((x1 - x0, y1 - y0), Image.LANCZOS)
        out = Image.new("RGBA", (W, H))
        out.paste(im, (x0, y0))
        return np.array(out)

    def stack(names: list[str]) -> np.ndarray:
        a = np.zeros((H, W, 4), np.uint8)
        for n in names:
            a = over(a, part(n))
        return a

    back = stack(["tail", "body", "armR"])
    front = stack(["earL", "earR", "head", "eyeLIris", "eyeLLash", "eyeRIris", "eyeRLash", "neck"])
    arm = part("armL")
    base = over(back, front)

    lids = np.asarray(Image.open(SRC / "mascot-wave-lids.png").convert("RGB"))
    eye_mask = lids[:, :, 0] > 127
    eyes = [dilate(e, 3) for e in components(eye_mask)]
    fur = sample(base, [(300, 300), (380, 300), (340, 250)])
    ink = (4, 9, 32)

    save(back, "wave-base.png")
    fbox = save(front, "wave-front.png", bbox(front[:, :, 3] > 4, pad=2))
    abox = save(arm, "wave-arm.png", bbox(arm[:, :, 3] > 4, pad=2))
    rig["wave"] = {
        "width": W,
        "height": H,
        "base": "wave-base.png",
        "front": fbox,
        "arm": {"box": abox, "pivot": tuple(parts["armL"]["pivot"])},
        "blink": [],
        "feet": (340, 950),
    }
    for i, (f, box) in enumerate(lid_frames(base, eyes, fur, ink, stroke=7)):
        save(f, f"wave-blink-{i + 1}.png")
        rig["wave"]["blink"].append(box)

    # head: the wave drawing without the raised arm, cropped to the face
    hb = (40, 22, 652, 640)
    head = base.copy()
    save(head, "head-base.png", hb)
    rig["head"] = {"width": hb[2] - hb[0], "height": hb[3] - hb[1], "offset": hb[:2]}

    # ---------------- celebrate ----------------
    cel = load(SRC / "brand-mascot-celebrate-cartoon.png")
    CH, CW = cel.shape[:2]
    cel_eyes = []
    rgb = cel[:, :, :3].astype(int)
    eyeish = (rgb.min(2) > 225) | (rgb.max(2) < 120)
    furish = (rgb[:, :, 0] > 190) & (rgb[:, :, 2] < 120)
    # The Rive scene stores lid centres; fit each lid to the eye it covers.
    for name, (cx, cy) in (("lid-l.png", (203, 362)), ("lid-r.png", (413, 397))):
        lid = load(SRC / "mascot-layers/celebrate" / name)
        lm = lid[:, :, 3] > 127
        lh, lw = lm.shape
        best = None
        for dy in range(-20, 21, 2):
            for dx in range(-20, 21, 2):
                x, y = cx - lw // 2 + dx, cy - lh // 2 + dy
                score = (lm & eyeish[y : y + lh, x : x + lw]).sum() - 2 * (lm & furish[y : y + lh, x : x + lw]).sum()
                if best is None or score > best[0]:
                    best = (score, x, y)
        _, x, y = best
        m = np.zeros((CH, CW), bool)
        m[y : y + lh, x : x + lw] = lm
        cel_eyes.append(dilate(m, 4))
        print("celebrate", name, "at", x, y)
    cel = deepen(cel)
    cfur = sample(cel, [(340, 300), (300, 290), (380, 300)])
    save(cel, "celebrate-base.png")
    rig["celebrate"] = {"width": CW, "height": CH, "base": "celebrate-base.png", "blink": []}
    for i, (f, box) in enumerate(lid_frames(cel, cel_eyes, cfur, ink, stroke=6)):
        save(f, f"celebrate-blink-{i + 1}.png")
        rig["celebrate"]["blink"].append(box)

    print("fur", fur, "celebrate fur", cfur)
    write_ts(rig)


def write_ts(rig):
    def box(b):
        x0, y0, x1, y1 = b
        return f"{{ x: {x0}, y: {y0}, w: {x1 - x0}, h: {y1 - y0} }}"

    w, c, h = rig["wave"], rig["celebrate"], rig["head"]
    lines = [
        "// Generated by scripts/build-mascot-rig.py. Do not edit by hand.",
        "/* eslint-disable */",
        "export type Frame = { x: number; y: number; w: number; h: number };",
        "",
        "export const WAVE = {",
        f"  width: {w['width']},",
        f"  height: {w['height']},",
        "  base: require('../../../assets/mascot/rig/wave-base.png'),",
        f"  front: {{ src: require('../../../assets/mascot/rig/wave-front.png'), frame: {box(w['front'])} }},",
        f"  arm: {{ src: require('../../../assets/mascot/rig/wave-arm.png'), frame: {box(w['arm']['box'])}, pivot: {{ x: {w['arm']['pivot'][0]}, y: {w['arm']['pivot'][1]} }} }},",
        "  blink: [",
        *[f"    {{ src: require('../../../assets/mascot/rig/wave-blink-{i + 1}.png'), frame: {box(b)} }}," for i, b in enumerate(w["blink"])],
        "  ],",
        "} as const;",
        "",
        "export const CELEBRATE = {",
        f"  width: {c['width']},",
        f"  height: {c['height']},",
        "  base: require('../../../assets/mascot/rig/celebrate-base.png'),",
        "  blink: [",
        *[f"    {{ src: require('../../../assets/mascot/rig/celebrate-blink-{i + 1}.png'), frame: {box(b)} }}," for i, b in enumerate(c["blink"])],
        "  ],",
        "} as const;",
        "",
        "/** The head pose is the wave base cropped to the face; blink frames are shared with WAVE. */",
        "export const HEAD = {",
        f"  width: {h['width']},",
        f"  height: {h['height']},",
        f"  offset: {{ x: {h['offset'][0]}, y: {h['offset'][1]} }},",
        "  base: require('../../../assets/mascot/rig/head-base.png'),",
        "} as const;",
        "",
    ]
    TS.parent.mkdir(parents=True, exist_ok=True)
    TS.write_text("\n".join(lines))
    print("wrote", TS)


if __name__ == "__main__":
    main()
