"""Residue cleanup for exported mascot layers (used by mascot-coach-layers.py, or run directly).

Cutting the raised arm out of the flat drawing leaves two kinds of residue that only show once
the arm moves: hair-thin strands of the arm's old outline on the neighbouring layers, and pale
anti-aliasing halos along cut edges (white slivers at the elbow, shoulder and bandana).

    python3 scripts/mascot_cleanup.py   # cleans public/mascot-layers/coach/wave in place

mascot-coach-layers.py runs this after every cut, so only run it by hand on a fresh export.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# layers that meet the raised arm (wave drawing only)
NEAR_ARM = ("head", "neck", "body", "armLUpper", "armLFore", "armLHoof", "earL")


def _grow(mask: np.ndarray, r: int) -> np.ndarray:
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    return np.asarray(im.filter(ImageFilter.MaxFilter(r * 2 + 1))) > 0


def _shrink(mask: np.ndarray, r: int) -> np.ndarray:
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    return np.asarray(im.filter(ImageFilter.MinFilter(r * 2 + 1))) > 0


def clean(rgba: np.ndarray) -> np.ndarray:
    """Return a copy with thin strands and pale edge halos made transparent."""
    out = rgba.copy()
    a = out[:, :, 3]
    solid = a > 24
    # strands: anything an opening of radius 1 removes is at most ~2 px wide
    body = _grow(_shrink(solid, 1), 1)
    strands = solid & ~body
    # pale halo: near-white pixels on the outer 2 px rim of the shape
    rgb = out[:, :, :3].astype(np.int16)
    pale = rgb.min(axis=2) > 205
    rim = solid & ~_shrink(solid, 2)
    halo = pale & rim
    # faint specks the eye reads as grit once they move: low-alpha pixels off the main shape
    specks = (a > 0) & ~_grow(body, 1)
    kill = strands | halo | specks
    out[kill, 3] = 0
    return out


def clean_file(path: Path) -> None:
    im = np.array(Image.open(path).convert("RGBA"))
    Image.fromarray(clean(im)).save(path, optimize=True)


# ---------------------------------------------------------------- one-piece raised arm
# The raised arm was cut into shoulder / forearm / hoof pieces. Bending them apart shows the cut
# edges (notches, broken outline, ink strands), so the wave swings the arm whole from the
# shoulder instead, and the pieces are merged back into one image. They fit exactly at rest
# because they come from one drawing. The only edge the drawing never inked is the one that
# lay against the cheek; it gets an outline so the arm reads cleanly when it swings away.
INK = (4, 9, 31)
ARM = ("armLUpper", "armLFore", "armLHoof")
K = 2.5  # working pixels per drawing unit (~4x the exported layer resolution)
INK_W = 6.0  # outline width in drawing units, matched to the drawing's own outline
EXPORT = 0.62


def _box_filter(mask: np.ndarray, r: float, grow: bool) -> np.ndarray:
    n = max(1, int(round(r * K)))
    im = Image.fromarray(mask.astype(np.uint8) * 255)
    im = im.filter(ImageFilter.MaxFilter(n * 2 + 1) if grow else ImageFilter.MinFilter(n * 2 + 1))
    return np.asarray(im) > 0


def _largest(mask: np.ndarray) -> np.ndarray:
    """The biggest 4-connected region of `mask`."""
    seen = np.zeros_like(mask)
    best: list = []
    h, w = mask.shape
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack, comp = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    stack.append((yy, xx))
        if len(comp) > len(best):
            best = comp
    out = np.zeros_like(mask)
    if best:
        ys, xs = zip(*best)
        out[list(ys), list(xs)] = True
    return out


def _hull_mask(mask: np.ndarray) -> np.ndarray:
    ys, xs = np.nonzero(mask)
    pts = sorted(set(zip(xs.tolist(), ys.tolist())))

    def cross(o, p, q):
        return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])

    lower: list = []
    upper: list = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    im = Image.new("L", (mask.shape[1], mask.shape[0]))
    ImageDraw.Draw(im).polygon(lower[:-1] + upper[:-1], fill=255)
    return np.asarray(im) > 0


def merge_arm(pose_dir: Path, parts: dict) -> dict:
    """Write armL.png (the whole raised arm) and return its rig entry."""
    x0 = min(parts[n]["bbox"][0] for n in ARM + ("head",))
    y0 = min(parts[n]["bbox"][1] for n in ARM)
    x1 = max(parts[n]["bbox"][2] for n in ARM)
    y1 = max(parts[n]["bbox"][3] for n in ARM)
    W, H = int((x1 - x0) * K), int((y1 - y0) * K)

    def place(n: str) -> np.ndarray:
        bx0, by0, bx1, by1 = parts[n]["bbox"]
        box = (int((bx0 - x0) * K), int((by0 - y0) * K), int((bx1 - x0) * K), int((by1 - y0) * K))
        src = Image.open(pose_dir / f"{n}.png").convert("RGBA").resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
        canvas = Image.new("RGBA", (W, H))
        # the head box can start left of the arm box; clip to the canvas
        canvas.paste(src, (box[0], box[1]))
        return np.array(canvas)

    arm = Image.new("RGBA", (W, H))
    for n in ("armLFore", "armLHoof", "armLUpper"):  # the rig's back-to-front order
        arm.alpha_composite(Image.fromarray(place(n)))
    a = np.array(arm)
    solid = a[:, :, 3] > 127
    # The cheek-side edge is a cut, not a contour: notched, with a strip of the cheek's outline
    # running alongside. Drop thin strips, then square the edge off to the arm's convex outline
    # (below the hoof only, so the hoof keeps the dip between its two toes).
    core = _box_filter(_box_filter(solid, 3, False), 3, True)
    hull = _hull_mask(core)
    below_hoof = np.zeros_like(solid)
    below_hoof[int((parts["armLHoof"]["bbox"][3] - 26 - y0) * K) :, :] = True
    fill = hull & ~solid & below_hoof
    fur_px = a[solid & ~_box_filter(~solid, INK_W, True)][:, :3]
    fur_px = fur_px[fur_px.max(axis=1) > 120]
    fur = np.median(fur_px, axis=0).astype(np.uint8)
    a[fill, :3] = fur
    a[fill, 3] = 255
    a[~hull, 3] = 0
    solid = a[:, :, 3] > 127
    # seams between pieces: fully opaque inside the merged silhouette
    a[_box_filter(solid, 1.5, False), 3] = 255

    # Cheek side = the arm's edge facing right of its shoulder-to-hoof axis. Inside a strip along
    # that edge: flat fur (no leftover specks of the old cut), then a fresh outline of even width.
    (sx, sy), (hx, hy) = parts["armLUpper"]["pivot"], parts["armLHoof"]["center"]
    ax, ay = hx - sx, hy - sy
    norm = (ax * ax + ay * ay) ** 0.5
    nx, ny = -ay / norm, ax / norm  # right-hand normal of the axis (points at the cheek)
    if nx < 0:
        nx, ny = -nx, -ny

    def facing_out(width: float) -> np.ndarray:
        d = width * K
        shifted = np.roll(np.roll(solid, -int(round(ny * d)), axis=0), -int(round(nx * d)), axis=1)
        return solid & ~shifted

    # the hoof: the big dark blob, without the ragged outline bits hanging off it
    dark = ~below_hoof & solid & (a[:, :, :3].max(axis=2) < 90)
    hoof_dark = _largest(_box_filter(_box_filter(dark, 5, False), 5, True)) & dark
    strip = facing_out(INK_W * 2.5) & ~hoof_dark
    a[strip, :3] = fur
    ink = facing_out(INK_W * 1.4) & ~hoof_dark
    ink_im = Image.fromarray(ink.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(0.6 * K))
    cover = (np.asarray(ink_im) / 255.0)[:, :, None]
    a[:, :, :3] = (a[:, :, :3] * (1 - cover) + np.array(INK) * cover).astype(np.uint8)

    bb = Image.fromarray(a[:, :, 3]).getbbox()
    crop = Image.fromarray(a).crop(bb)
    size = (max(1, round(crop.width / K * EXPORT)), max(1, round(crop.height / K * EXPORT)))
    small = np.array(crop.resize(size, Image.LANCZOS))
    small[small[:, :, 3] < 8] = 0
    Image.fromarray(small).save(pose_dir / "armL.png", optimize=True)
    bx = [round(x0 + bb[0] / K), round(y0 + bb[1] / K), round(x0 + bb[2] / K), round(y0 + bb[3] / K)]
    return {
        "file": "mascot-layers/coach/wave/armL.png",
        "bbox": bx,
        "center": [(bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2],
        "pivot": parts["armLUpper"]["pivot"],
    }


def run(web: Path) -> None:
    """Clean the wave layers in place and add the merged arm to rig.json."""
    import json

    pose_dir = web / "public/mascot-layers/coach/wave"
    for pid in NEAR_ARM:
        clean_file(pose_dir / f"{pid}.png")
    rig_path = web / "public/mascot-layers/coach/rig.json"
    rig = json.loads(rig_path.read_text())
    rig["wave"]["parts"]["armL"] = merge_arm(pose_dir, rig["wave"]["parts"])
    rig_path.write_text(json.dumps(rig, indent=1))
    print("cleaned", ", ".join(NEAR_ARM), "and merged armL", rig["wave"]["parts"]["armL"]["bbox"])


if __name__ == "__main__":
    run(Path(__file__).resolve().parents[1])
