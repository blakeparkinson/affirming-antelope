// SVG path data -> rive-mcp-server polygon subpaths (absolute artboard coordinates).
//
// Supports M L H V C S Q T Z (absolute and relative). Every vertex is emitted as a cubic
// "detached" vertex: its in and out handles are the control points of the segments on either
// side (zero length for straight segments), so curves come through exactly.

const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

function tokenize(d) {
  const out = [];
  for (const m of d.matchAll(/([MLHVCSQTZmlhvcsqtz])([^MLHVCSQTZmlhvcsqtz]*)/g)) {
    out.push({ cmd: m[1], args: (m[2].match(NUM) ?? []).map(Number) });
  }
  return out;
}

/** Parse into subpaths of cubic segments: { start, segs: [{c1, c2, p}], closed }. */
export function parse(d) {
  const subs = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let lastC2 = null; // for S
  let lastQ = null; // for T
  const line = (nx, ny) => {
    cur.segs.push({ c1: { x, y }, c2: { x: nx, y: ny }, p: { x: nx, y: ny }, straight: true });
    x = nx;
    y = ny;
  };
  for (const { cmd, args } of tokenize(d)) {
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = () => (rel ? x : 0);
    const oy = () => (rel ? y : 0);
    if (C === "Z") {
      if (cur) {
        cur.closed = true;
        x = cur.start.x;
        y = cur.start.y;
      }
      lastC2 = lastQ = null;
      continue;
    }
    let i = 0;
    let first = true;
    while (i < args.length || (first && C === "Z")) {
      first = false;
      if (C === "M") {
        const nx = ox() + args[i++];
        const ny = oy() + args[i++];
        if (cur && !cur.segs.length && !cur.closed) cur.start = { x: nx, y: ny };
        else {
          cur = { start: { x: nx, y: ny }, segs: [], closed: false };
          subs.push(cur);
        }
        x = nx;
        y = ny;
        // further pairs after M are line-tos
        while (i < args.length) line(ox() + args[i++], oy() + args[i++]);
        lastC2 = lastQ = null;
      } else if (C === "L") {
        line(ox() + args[i++], oy() + args[i++]);
        lastC2 = lastQ = null;
      } else if (C === "H") {
        line((rel ? x : 0) + args[i++], y);
        lastC2 = lastQ = null;
      } else if (C === "V") {
        line(x, (rel ? y : 0) + args[i++]);
        lastC2 = lastQ = null;
      } else if (C === "C") {
        const c1 = { x: ox() + args[i], y: oy() + args[i + 1] };
        const c2 = { x: ox() + args[i + 2], y: oy() + args[i + 3] };
        const p = { x: ox() + args[i + 4], y: oy() + args[i + 5] };
        i += 6;
        cur.segs.push({ c1, c2, p });
        x = p.x;
        y = p.y;
        lastC2 = c2;
        lastQ = null;
      } else if (C === "S") {
        const c1 = lastC2 ? { x: 2 * x - lastC2.x, y: 2 * y - lastC2.y } : { x, y };
        const c2 = { x: ox() + args[i], y: oy() + args[i + 1] };
        const p = { x: ox() + args[i + 2], y: oy() + args[i + 3] };
        i += 4;
        cur.segs.push({ c1, c2, p });
        x = p.x;
        y = p.y;
        lastC2 = c2;
        lastQ = null;
      } else if (C === "Q" || C === "T") {
        let q;
        if (C === "Q") {
          q = { x: ox() + args[i], y: oy() + args[i + 1] };
          i += 2;
        } else q = lastQ ? { x: 2 * x - lastQ.x, y: 2 * y - lastQ.y } : { x, y };
        const p = { x: ox() + args[i], y: oy() + args[i + 1] };
        i += 2;
        const c1 = { x: x + (2 / 3) * (q.x - x), y: y + (2 / 3) * (q.y - y) };
        const c2 = { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) };
        cur.segs.push({ c1, c2, p });
        x = p.x;
        y = p.y;
        lastQ = q;
        lastC2 = null;
      } else throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return subs;
}

const handle = (from, to) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  return { rotation: dist ? (Math.atan2(dy, dx) * 180) / Math.PI : 0, distance: dist };
};
const near = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Subpaths in the scene's polygon format, relative to (ox, oy) (the shape's origin).
 * Each point: { x, y, cubic: { inRotation, inDistance, rotation (out), outDistance } }.
 */
export function toRive(d, ox = 0, oy = 0) {
  return parse(d).map((sp) => {
    const pts = [{ p: sp.start, inH: null, outH: null }];
    for (const s of sp.segs) {
      pts[pts.length - 1].outH = handle(pts[pts.length - 1].p, s.c1);
      pts.push({ p: s.p, inH: handle(s.p, s.c2), outH: null });
    }
    // closed and back at the start: the last point is the first, so merge its in-handle
    if (sp.closed && pts.length > 1 && near(pts[pts.length - 1].p, pts[0].p)) {
      pts[0].inH = pts.pop().inH;
    } else if (sp.closed && pts.length > 1) {
      // implicit straight closing segment
      pts[pts.length - 1].outH = { rotation: 0, distance: 0 };
      pts[0].inH = { rotation: 0, distance: 0 };
    }
    return {
      closed: sp.closed,
      points: pts.map(({ p, inH, outH }) => {
        const i = inH ?? { rotation: 0, distance: 0 };
        const o = outH ?? { rotation: 0, distance: 0 };
        return {
          x: r2(p.x - ox),
          y: r2(p.y - oy),
          cubic: { inRotation: r2(i.rotation), inDistance: r2(i.distance), rotation: r2(o.rotation), outDistance: r2(o.distance) },
        };
      }),
    };
  });
}
