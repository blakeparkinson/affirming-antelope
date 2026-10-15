// Path landmarks, drawn in the mascot's style: flat fills, one shade and one highlight per
// material, a thick ink outline, chunky rounded shapes. Coordinates are art units on each
// landmark's artboard; `ground` is the y the landmark stands on (its base sits there), `pad` grows
// the artboard around the drawing, and `peek` is how much of it may run off the screen edge.
//
// A part is one of:
//   { d, fill, shades: [{ d, color }], lines: [d], group }   a piece: fill, clipped shading, ink outline
//   { flat, color, opacity, group }                            a plain fill, no outline
//   { line, width, group }                                     an open ink stroke
// Groups pivot at `at` (absolute art units) and nest; the idle loop animates groups only.

export const INK = "#0B1630";

const C = {
  bark: "#B27548",
  barkShade: "#8E5733",
  barkLight: "#D29A68",
  leaf: "#86AC5C",
  leafShade: "#5F8A44",
  leafLight: "#B2D07E",
  grass: "#D7B85E",
  grassShade: "#B8963E",
  shadow: "#0A284E",
  rock: "#BDB8D1",
  rockShade: "#9993B4",
  rockLight: "#DEDAEA",
  sand: "#EBCF95",
  sandShade: "#D3AE6C",
  water: "#7E97F2",
  waterDeep: "#627DE6",
  waterLight: "#AEBDF9",
  glint: "#F1F4FF",
  reed: "#9DBB6A",
  reedShade: "#789A4C",
  cattail: "#8E5733",
  straw: "#DDBB6C",
  strawShade: "#B9933F",
  cobalt: "#4F6BED",
  cobaltShade: "#3550C8",
  cobaltLight: "#AEBBFA",
  ochre: "#E8A638",
  petal: "#F4A9BC",
};

// ---------------------------------------------------------------- helpers

const f = (n) => +n.toFixed(1);

/** A smooth closed curve through points (Catmull-Rom as cubics). */
function closedCurve(pts, tension = 1) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const k = tension / 6;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

/**
 * A leafy clump: round scallops around an ellipse, full on top, nearly flat underneath.
 * Each scallop is a cubic from one rim point to the next, pushed outward from the centre.
 */
function clump(cx, cy, rx, ry, bumps = 7, seed = 1) {
  const n = bumps;
  const rim = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + Math.PI / 2 + 0.35 * Math.sin(seed);
    const wob = 1 + 0.05 * Math.sin(seed * 2.3 + i * 1.9);
    rim.push([cx + Math.cos(t) * rx * 0.86 * wob, cy + Math.sin(t) * ry * 0.82 * wob]);
  }
  let d = `M${f(rim[0][0])} ${f(rim[0][1])}`;
  for (let i = 0; i < n; i++) {
    const A = rim[i];
    const B = rim[(i + 1) % n];
    const mx = (A[0] + B[0]) / 2;
    const my = (A[1] + B[1]) / 2;
    let nx = mx - cx;
    let ny = (my - cy) * (rx / ry);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const under = my > cy + ry * 0.25; // the underside stays calm
    const h = Math.hypot(B[0] - A[0], B[1] - A[1]) * (under ? 0.16 : 0.46) * 1.33;
    const c1 = [A[0] + (B[0] - A[0]) * 0.12 + nx * h, A[1] + (B[1] - A[1]) * 0.12 + ny * h];
    const c2 = [A[0] + (B[0] - A[0]) * 0.88 + nx * h, A[1] + (B[1] - A[1]) * 0.88 + ny * h];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(B[0])} ${f(B[1])}`;
  }
  return `${d} Z`;
}

/** An ellipse as a closed curve. */
function ellipse(cx, cy, rx, ry) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return closedCurve(pts, 1.1);
}

/**
 * A grass tuft standing at (x, y): one chunky silhouette with three curved tips (left, tall
 * middle, right), so it reads as a clump rather than three outlined spikes.
 */
function tuft(x, y, s = 1, lean = 0) {
  const P = (dx, dy) => `${f(x + (dx + lean * (-dy / 36)) * s)} ${f(y + dy * s)}`;
  return (
    `M${P(-17, 0)}` +
    ` C${P(-17, -8)} ${P(-20, -18)} ${P(-24, -26)}` + // left tip, curling out
    ` C${P(-15, -22)} ${P(-10, -16)} ${P(-7, -12)}` + // valley
    ` C${P(-6, -22)} ${P(-3, -32)} ${P(1, -38)}` + // middle tip
    ` C${P(4, -30)} ${P(6, -20)} ${P(7, -12)}` + // valley
    ` C${P(11, -16)} ${P(17, -21)} ${P(24, -24)}` + // right tip
    ` C${P(20, -16)} ${P(17, -8)} ${P(17, 0)}` +
    ` C${P(6, 2)} ${P(-6, 2)} ${P(-17, 0)} Z`
  );
}

/** Keyframes for a sine loop: amplitude a, phase (0..1), over T seconds, sampled 8 times. */
function wave(a, phase, T) {
  const keys = [];
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * T;
    keys.push([t, +(a * Math.sin(2 * Math.PI * (i / 8 + phase))).toFixed(3)]);
  }
  return keys;
}

// ---------------------------------------------------------------- baobab

const baobabTips = [
  // [x, y, rx, ry] of each clump, left to right
  [96, 84, 46, 30],
  [146, 46, 42, 28],
  [200, 30, 48, 30],
  [260, 50, 44, 28],
  [306, 88, 44, 28],
];

const baobab = {
  size: [400, 330],
  pad: [0, 24, 0, 0],
  ground: 304,
  groups: [
    ...baobabTips.map(([x, y], i) => ({ id: `leaf${i}`, at: [x, y + 22] })),
    { id: "tuftL", at: [112, 304] },
    { id: "tuftR", at: [292, 304] },
  ],
  parts: [
    { flat: ellipse(200, 306, 150, 13), color: C.shadow, opacity: 0.1 },
    // clumps behind the branch tips
    ...baobabTips.map(([x, y, rx, ry], i) => ({
      group: `leaf${i}`,
      d: clump(x, y, rx, ry, 7, i + 1),
      fill: C.leaf,
      shades: [
        { d: ellipse(x + 6, y + ry * 0.75, rx * 1.1, ry * 0.62), color: C.leafShade },
        { d: ellipse(x - rx * 0.35, y - ry * 0.42, rx * 0.3, ry * 0.2), color: C.leafLight },
      ],
    })),
    {
      d: `M128 304 C116 266 120 216 146 184 C158 168 160 152 156 138
          C140 126 116 116 98 102 C88 94 94 82 106 86 C126 94 148 106 166 116
          C160 96 150 78 140 62 C134 52 148 46 154 56 C164 72 172 92 182 108
          C184 86 186 64 190 46 C192 36 206 36 208 46 C210 64 212 86 214 108
          C226 92 240 74 252 60 C258 52 270 58 264 68 C254 84 242 100 234 116
          C254 106 280 98 300 92 C312 88 316 102 304 106 C284 114 260 124 242 136
          C238 154 242 170 254 184 C280 214 286 266 272 304
          C230 312 170 312 128 304 Z`,
      fill: C.bark,
      shades: [
        { d: "M214 112 C226 150 236 196 236 248 C236 280 234 300 232 316 L330 316 L330 100 Z", color: C.barkShade },
        { d: "M152 196 C140 228 140 264 150 292 C158 262 156 228 164 200 Z", color: C.barkLight },
        { d: "M108 92 C120 96 136 104 148 110 C132 106 118 100 108 92 Z", color: C.barkLight },
      ],
      lines: [
        "M198 168 C194 198 196 230 192 266",
        "M228 196 C233 222 231 250 236 278",
        "M168 228 C165 246 167 262 165 280",
        "M186 110 C190 124 196 132 204 136",
      ],
    },
    { group: "tuftL", d: tuft(112, 304, 1.5, -2), fill: C.grass, shades: [{ d: "M90 300 L140 300 L140 320 L90 320 Z", color: C.grassShade }], width: 5 },
    { group: "tuftR", d: tuft(292, 304, 1.3, 2), fill: C.grass, shades: [{ d: "M270 300 L320 300 L320 320 L270 320 Z", color: C.grassShade }], width: 5 },
  ],
  anim: {
    duration: 4.8,
    tracks: [
      ...baobabTips.map((_, i) => ({ target: `leaf${i}`, property: "rotation", keys: wave(i % 2 ? 2.2 : -2.2, i * 0.17, 4.8) })),
      ...baobabTips.map((_, i) => ({ target: `leaf${i}`, property: "y", keys: wave(1.4, i * 0.17 + 0.25, 4.8) })),
      { target: "tuftL", property: "rotation", keys: wave(5, 0.1, 4.8) },
      { target: "tuftR", property: "rotation", keys: wave(-5, 0.35, 4.8) },
    ],
  },
};

// ---------------------------------------------------------------- shared bits

/** A boulder: a rounded shape through `pts`, shaded lower right, lit upper left. */
function boulder(pts, light, extra = {}) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const w = x1 - x0;
  const h = y1 - y0;
  return {
    d: closedCurve(pts, 1.05),
    fill: C.rock,
    shades: [
      { d: ellipse(x0 + w * 0.72, y0 + h * 0.86, w * 0.62, h * 0.5), color: C.rockShade },
      ...(light ? [{ d: ellipse(x0 + w * 0.3, y0 + h * 0.24, w * 0.16, h * 0.08), color: C.rockLight }] : []),
    ],
    ...extra,
  };
}

/** A capsule (a cattail head, a glint). */
function capsule(cx, cy, w, h) {
  return ellipse(cx, cy, w / 2, h / 2);
}

// ---------------------------------------------------------------- kopje

const kopje = {
  size: [380, 262],
  pad: [0, 12, 0, 0],
  ground: 250,
  groups: [
    { id: "bush", at: [104, 206] },
    { id: "bird", at: [214, 64] },
    { id: "tuft0", at: [36, 250] },
    { id: "tuft1", at: [176, 250] },
    { id: "tuft2", at: [246, 250] },
  ],
  parts: [
    { flat: ellipse(200, 252, 176, 11), color: C.shadow, opacity: 0.1 },
    {
      group: "bush",
      d: clump(104, 170, 50, 38, 8, 3),
      fill: C.leaf,
      shades: [
        { d: ellipse(112, 198, 56, 22), color: C.leafShade },
        { d: ellipse(86, 150, 14, 7), color: C.leafLight },
      ],
    },
    boulder([[106, 250], [98, 196], [118, 136], [172, 102], [246, 104], [290, 142], [300, 200], [292, 250]], true, {
      lines: ["M150 156 C158 174 152 192 160 210", "M252 126 C244 140 250 152 242 166"],
    }),
    boulder([[58, 250], [56, 216], [82, 188], [124, 184], [152, 208], [156, 250]], true),
    boulder([[256, 250], [262, 220], [292, 198], [330, 204], [348, 232], [346, 250]], true),
    boulder([[170, 106], [172, 80], [198, 62], [232, 66], [248, 88], [240, 108]], true),
    // the bird: a little cobalt sunbird on the top rock, facing left
    { group: "bird", d: "M227 49 L246 41 L243 55 Z", fill: C.cobaltShade, width: 4 },
    { group: "bird", line: "M210 57 L209 65", width: 3.5 },
    { group: "bird", line: "M219 57 L220 65", width: 3.5 },
    {
      group: "bird",
      d: ellipse(215, 47, 15, 11),
      fill: C.cobalt,
      shades: [
        { d: ellipse(212, 55, 12, 5), color: C.cobaltLight },
        { d: ellipse(222, 44, 8, 6), color: C.cobaltShade },
      ],
      width: 5,
    },
    { group: "bird", d: "M196 35 L186 38.5 L196 41 Z", fill: C.ochre, width: 3.5 },
    { group: "bird", d: ellipse(203, 36, 8.5, 8), fill: C.cobalt, width: 5 },
    { group: "bird", flat: ellipse(201, 34.5, 1.9, 2.3), color: INK },
    { group: "tuft0", d: tuft(36, 250, 1.2, -1), fill: C.grass, width: 5 },
    { group: "tuft1", d: tuft(176, 250, 1.3, 1), fill: C.grass, width: 5 },
    { group: "tuft2", d: tuft(246, 252, 1.05, 2), fill: C.grass, width: 5 },
  ],
  anim: {
    duration: 5,
    tracks: [
      { target: "bush", property: "rotation", keys: wave(1.6, 0, 5) },
      { target: "tuft0", property: "rotation", keys: wave(5, 0.1, 5) },
      { target: "tuft1", property: "rotation", keys: wave(-4, 0.3, 5) },
      { target: "tuft2", property: "rotation", keys: wave(4, 0.55, 5) },
      // the bird pecks twice, hops, then looks around
      {
        target: "bird",
        property: "rotation",
        keys: [[0, 0], [1.0, 0], [1.16, -16], [1.3, 0], [1.46, -16], [1.62, 0], [3.4, 0], [3.6, 6], [4.2, 6], [4.4, 0], [5, 0]],
      },
      { target: "bird", property: "y", keys: [[0, 0], [2.3, 0], [2.42, -7], [2.56, 0], [2.64, -2], [2.72, 0], [5, 0]] },
    ],
  },
};

// ---------------------------------------------------------------- watering hole

const pond = {
  size: [440, 192],
  pad: [0, 4, 24, 0],
  // the reeds and cattails are on its right: keep most of it on screen
  peek: 0.1,
  ground: 170,
  groups: [
    { id: "glintA", at: [200, 120] },
    { id: "glintB", at: [250, 136] },
    { id: "pads", at: [300, 128] },
    { id: "reeds", at: [392, 150] },
    { id: "reedsB", at: [370, 152] },
    { id: "tuft0", at: [60, 168] },
  ],
  parts: [
    {
      d: closedCurve([[20, 132], [44, 96], [120, 74], [226, 68], [330, 76], [404, 98], [426, 134], [398, 164], [300, 182], [180, 184], [74, 172]], 1.05),
      fill: C.sand,
      shades: [{ d: ellipse(226, 190, 230, 40), color: C.sandShade }],
    },
    {
      d: closedCurve([[56, 128], [84, 104], [160, 90], [240, 88], [320, 94], [382, 112], [388, 136], [350, 154], [260, 162], [150, 160], [80, 150]], 1.05),
      fill: C.water,
      shades: [
        { d: ellipse(236, 146, 150, 26), color: C.waterDeep },
        { d: ellipse(220, 88, 190, 14), color: C.waterLight },
      ],
      width: 6,
    },
    { group: "glintA", flat: capsule(170, 118, 48, 6), color: C.glint },
    { group: "glintA", flat: capsule(226, 108, 26, 5), color: C.glint },
    { group: "glintB", flat: capsule(252, 136, 60, 6), color: C.glint },
    { group: "glintB", flat: capsule(134, 136, 22, 5), color: C.glint },
    // lily pads, one with a flower
    {
      group: "pads",
      d: "M282 128 C282 120 296 116 306 117 L300 126 L314 124 C318 128 312 134 298 135 C288 135 282 132 282 128 Z",
      fill: C.leaf,
      shades: [{ d: ellipse(300, 136, 22, 4), color: C.leafShade }],
      width: 4.5,
    },
    { group: "pads", d: "M318 141 C318 136 328 133 335 134 L331 140 L341 139 C343 142 338 146 329 146 C322 146 318 144 318 141 Z", fill: C.leaf, width: 4.5 },
    { group: "pads", d: "M292 122 C288 114 292 108 296 112 C298 104 304 104 304 112 C308 108 312 114 308 122 Z", fill: C.petal, width: 4 },
    // rocks on the left bank
    boulder([[28, 140], [30, 122], [48, 112], [68, 116], [76, 134], [70, 144]], true),
    boulder([[60, 150], [64, 138], [80, 134], [94, 140], [94, 152]], false),
    // reeds and cattails on the right bank
    { group: "reedsB", line: "M366 150 C366 116 362 92 356 74", width: 4 },
    { group: "reedsB", d: capsule(355, 66, 9, 26), fill: C.cattail, width: 4.5 },
    { group: "reeds", line: "M396 150 C396 112 400 86 404 62", width: 4 },
    { group: "reeds", d: capsule(405, 52, 10, 28), fill: C.cattail, width: 4.5 },
    { group: "reeds", d: tuft(392, 154, 2.1, 3), fill: C.reed, shades: [{ d: ellipse(400, 160, 30, 16), color: C.reedShade }], width: 5 },
    { group: "tuft0", d: tuft(60, 170, 1.2, -1), fill: C.grass, width: 5 },
  ],
  anim: {
    duration: 4,
    tracks: [
      { target: "glintA", property: "x", keys: wave(7, 0, 4) },
      { target: "glintA", property: "opacity", keys: wave(0.3, 0.25, 4).map(([t, v]) => [t, 0.7 + v]) },
      { target: "glintB", property: "x", keys: wave(-8, 0.2, 4) },
      { target: "glintB", property: "opacity", keys: wave(0.3, 0.75, 4).map(([t, v]) => [t, 0.7 + v]) },
      { target: "pads", property: "y", keys: wave(1.6, 0.1, 4) },
      { target: "reeds", property: "rotation", keys: wave(3.2, 0, 4) },
      { target: "reedsB", property: "rotation", keys: wave(2.6, 0.3, 4) },
      { target: "tuft0", property: "rotation", keys: wave(4, 0.6, 4) },
    ],
  },
};

// ---------------------------------------------------------------- umbrella acacia with weaver nests

const nests = [
  // attach point on the canopy's underside, string length, size
  [134, 124, 16, 1],
  [204, 130, 24, 1.15],
  [302, 124, 14, 0.95],
];

function nest(ax, ay, len, s) {
  const cx = ax;
  const top = ay + len;
  return {
    d: `M${cx} ${top} C${cx + 13 * s} ${top} ${cx + 15 * s} ${top + 14 * s} ${cx + 12 * s} ${top + 24 * s} C${cx + 9 * s} ${top + 32 * s} ${cx + 4 * s} ${top + 36 * s} ${cx} ${top + 36 * s} C${cx - 4 * s} ${top + 36 * s} ${cx - 9 * s} ${top + 32 * s} ${cx - 12 * s} ${top + 24 * s} C${cx - 15 * s} ${top + 14 * s} ${cx - 13 * s} ${top} ${cx} ${top} Z`,
    fill: C.straw,
    shades: [{ d: ellipse(cx + 8 * s, top + 26 * s, 12 * s, 14 * s), color: C.strawShade }],
    lines: [`M${cx - 10 * s} ${top + 12 * s} C${cx - 3 * s} ${top + 16 * s} ${cx + 4 * s} ${top + 10 * s} ${cx + 11 * s} ${top + 14 * s}`],
    lineWidth: 2.6,
    width: 5,
  };
}

const acacia = {
  size: [440, 312],
  pad: [0, 10, 0, 0],
  ground: 300,
  groups: [
    ...nests.map(([x, y], i) => ({ id: `nest${i}`, at: [x, y] })),
    { id: "canopy", at: [220, 120] },
    { id: "tuft0", at: [170, 300] },
    { id: "tuft1", at: [268, 300] },
  ],
  parts: [
    { flat: ellipse(220, 302, 120, 10), color: C.shadow, opacity: 0.1 },
    {
      d: "M200 302 C206 270 204 230 200 196 C184 172 166 150 146 120 L162 114 C178 138 196 160 212 178 C230 158 256 136 274 112 L290 118 C270 146 242 174 226 198 C222 232 224 270 232 302 Z",
      fill: C.bark,
      shades: [{ d: "M218 180 C222 220 224 260 226 310 L300 310 L300 100 Z", color: C.barkShade }],
      lines: ["M212 222 C210 240 213 256 211 272"],
    },
    // nests hang from the underside, in front of the trunk's top
    ...nests.flatMap(([x, y, len, s], i) => [
      { group: `nest${i}`, line: `M${x} ${y} L${x} ${y + len}`, width: 3 },
      { group: `nest${i}`, ...nest(x, y, len, s) },
      { group: `nest${i}`, flat: ellipse(x, y + len + 31 * s, 4.5 * s, 3.5 * s), color: INK },
    ]),
    // canopy: a darker back layer, then the flat-bottomed umbrella
    { group: "canopy", d: clump(258, 76, 148, 32, 9, 5), fill: C.leafShade, width: 7 },
    {
      group: "canopy",
      d: clump(218, 98, 200, 38, 12, 2),
      fill: C.leaf,
      shades: [
        { d: ellipse(226, 132, 220, 18), color: C.leafShade },
        { d: ellipse(110, 80, 34, 8), color: C.leafLight },
        { d: ellipse(230, 70, 22, 6), color: C.leafLight },
      ],
    },
    { group: "tuft0", d: tuft(170, 300, 1.2, -2), fill: C.grass, width: 5 },
    { group: "tuft1", d: tuft(268, 300, 1.1, 2), fill: C.grass, width: 5 },
  ],
  anim: {
    duration: 5.2,
    tracks: [
      ...nests.map((_, i) => ({ target: `nest${i}`, property: "rotation", keys: wave(i === 1 ? 7 : 5, i * 0.3, 5.2) })),
      { target: "canopy", property: "y", keys: wave(1.2, 0, 5.2) },
      { target: "canopy", property: "rotation", keys: wave(0.6, 0.2, 5.2) },
      { target: "tuft0", property: "rotation", keys: wave(4, 0.15, 5.2) },
      { target: "tuft1", property: "rotation", keys: wave(-4, 0.5, 5.2) },
    ],
  },
};

export const LANDMARKS = { baobab, kopje, pond, acacia };
