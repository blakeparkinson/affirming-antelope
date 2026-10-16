#!/usr/bin/env python3
"""Deep-toned mascot stills.

The hero mascot is drawn by mascot-three.tsx, whose shaders write the sRGB
artwork's *linearised* values straight to the screen. That gives the fur a
deeper, richer brown than the source PNGs, and it's the look we ship. This
script bakes the identical transform into the flat images used everywhere
else (the wave still shown before WebGL is ready and under reduced motion, the
logo mark, the app icons, the guides / scenarios / trainer art, the link-preview
images and the learner app's icons) so every antelope is the same brown.

    python3 scripts/mascot-deepen.py
"""

import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

SOURCES = [
    "brand-mascot-wave-cartoon.png",
    "brand-mascot-celebrate-cartoon.png",
]

# Link-preview (Open Graph) art, read by src/lib/og.tsx from assets/og under fixed names,
# deepened from the caramel originals in assets/og-source (kept out of the bundled og folder).
OG = ROOT / "assets/og"
OG_SOURCE = ROOT / "assets/og-source"
OG_NAMES = ["mascot-wave", "mascot-celebrate", "logo"]

# The learner app's icons (Expo reads them by the paths in apps/mobile/app.json). Generated from
# untouched caramel copies next to them, so running this again never deepens twice.
MOBILE_ICONS = ROOT.parent / "mobile/assets/images"
MOBILE_ICON_NAMES = ["icon", "android-icon-foreground", "favicon"]


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    """Exact sRGB electro-optical transfer function, 0..1 in and out."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def deepen(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    a = np.asarray(im).astype(np.float64)
    rgb = srgb_to_linear(a[:, :, :3] / 255.0)
    a[:, :, :3] = np.round(rgb * 255.0)
    Image.fromarray(a.astype(np.uint8)).save(dst, optimize=True)
    print(f"{src.name} -> {dst.name}")


def deepen_hex(h: str) -> str:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    rgb = np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)]) / 255.0
    out = np.round(srgb_to_linear(rgb) * 255).astype(int)
    return "#%02x%02x%02x" % tuple(out)


PATH_RE = re.compile(r'<path fill="(#[0-9a-fA-F]{3,6})" d="[Mm]\s*(-?\d+(?:\.\d+)?)[ ,]?(-?\d+(?:\.\d+)?)')


def deepen_svg(src: Path, dst: Path, is_mark) -> None:
    """Re-colour the antelope mark's path fills in place; `is_mark(x, y)` says
    whether a path starting at (x, y) belongs to the mark (vs. the wordmark)."""
    s = src.read_text()
    n = 0

    def sub(m: re.Match) -> str:
        nonlocal n
        colour, x, y = m.group(1), float(m.group(2)), float(m.group(3))
        if not is_mark(x, y):
            return m.group(0)
        n += 1
        return m.group(0).replace(f'fill="{colour}"', f'fill="{deepen_hex(colour)}"', 1)

    dst.write_text(PATH_RE.sub(sub, s))
    print(f"{src.name} -> {dst.name} ({n} fills)")


def deepen_over_background(src: Path, dst: Path, bg=(238, 241, 255)) -> None:
    """Opaque icon on a flat page-colour background: deepen the mark only."""
    im = Image.open(src).convert("RGBA")
    a = np.asarray(im).astype(np.float64)
    dist = np.abs(a[:, :, :3] - np.array(bg)).sum(2)
    w = np.clip(dist / 48.0, 0, 1)[:, :, None]  # soft so anti-aliased edges blend
    deep = srgb_to_linear(a[:, :, :3] / 255.0) * 255.0
    a[:, :, :3] = np.round(a[:, :, :3] * (1 - w) + deep * w)
    Image.fromarray(a.astype(np.uint8)).save(dst, optimize=True)
    print(f"{src.name} -> {dst.name}")


def main() -> None:
    for name in SOURCES:
        src = PUBLIC / name
        deepen(src, src.with_name(src.stem + "-deep.png"))

    # Logo: the antelope mark goes deep, the navy wordmark stays as set in CSS.
    deepen_svg(PUBLIC / "brand-logo.svg", PUBLIC / "brand-logo-deep.svg", lambda x, y: True)
    deepen_svg(
        PUBLIC / "brand-lockup-horizontal.svg",
        PUBLIC / "brand-lockup-horizontal-deep.svg",
        lambda x, y: x < 150,
    )
    deepen_svg(
        PUBLIC / "brand-lockup-stacked.svg",
        PUBLIC / "brand-lockup-stacked-deep.svg",
        lambda x, y: y < 300,
    )
    deepen(PUBLIC / "brand-logo.png", PUBLIC / "brand-logo-deep.png")

    # App icons are served from src/app by fixed filename, so they're generated
    # from untouched sources in public/ (keeps this script idempotent).
    app = ROOT / "src/app"
    deepen(PUBLIC / "brand-icon-source.png", app / "icon.png")
    deepen_over_background(PUBLIC / "brand-apple-icon-source.png", app / "apple-icon.png")
    icon = Image.open(app / "icon.png").convert("RGBA")
    icon.save(app / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("favicon.ico rebuilt from icon.png")

    for name in OG_NAMES:
        deepen(OG_SOURCE / f"{name}.png", OG / f"{name}.png")

    for name in MOBILE_ICON_NAMES:
        deepen(MOBILE_ICONS / f"{name}-source.png", MOBILE_ICONS / f"{name}.png")


if __name__ == "__main__":
    main()
