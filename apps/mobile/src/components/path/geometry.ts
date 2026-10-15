/**
 * Trail geometry for the Path screen. Pure functions so the layout is
 * deterministic and testable: node positions on a serpentine, a smooth cubic
 * path through them, and a length table for strokeDashoffset reveals.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface TrailLayout {
  width: number;
  height: number;
  /** Vertical spacing between weeks. */
  step: number;
  /** Serpentine half-width. */
  amp: number;
  nodes: Pt[];
  /** SVG path data for the whole trail, lead-in to finish. */
  d: string;
  /** Total path length. */
  length: number;
  /** Path length at each node. */
  nodeLen: number[];
  /** (y, length) samples, monotonic in y, for mapping scroll to drawn length. */
  ys: number[];
  lens: number[];
  start: Pt;
  finish: Pt;
}

export const NODE = 72;

/** Node spacing for the 12-week course; shorter courses breathe a little more. */
export const STEP = 172;
/** Gap from the last node down to the finish flag, beyond one step. */
const FINISH_RUN = 18;
/** Ground left below the finish flag: its caption, then the destination meadow. */
export const FINISH_TAIL = 200;

/**
 * Spacing for a course of `count` weeks. The 12-week course keeps 172pt; an
 * 8-week one opens up to 184pt so it reads as a journey rather than a short
 * list, without leaving empty ground between labels (cap 190).
 */
export function trailStep(count: number): number {
  return Math.min(190, STEP + Math.max(0, 12 - count) * 3);
}

/**
 * Nodes sit on a sine serpentine. The swing rate is tuned per course so the
 * last week always lands at a full swing (|sin| = 1) and the trail makes one
 * confident sweep into the centred finish, whatever the length: the nearest
 * odd quarter-turn to ~0.95 rad per week (12 weeks → 0.99, 8 weeks → 1.10).
 */
function swing(count: number, phase0: number): number {
  if (count < 2) return 0;
  const natural = phase0 + (count - 1) * 0.95;
  const k = Math.max(1, Math.round(natural / Math.PI - 0.5));
  return ((k + 0.5) * Math.PI - phase0) / (count - 1);
}

export function layoutTrail(width: number, count: number, top: number): TrailLayout {
  const step = trailStep(count);
  // a shorter course swings a touch wider (8 weeks: +4%), still leaving label room on narrow phones
  const extra = Math.max(0, 12 - count);
  const amp = Math.min(width * (0.27 + extra * 0.0025), 120 + extra * 1.5);
  const cx = width / 2;
  const phase0 = 0.15;
  const w = swing(count, phase0);
  const nodes: Pt[] = Array.from({ length: count }, (_, i) => ({
    x: cx + amp * Math.sin(phase0 + i * w),
    y: top + i * step,
  }));
  const start = { x: nodes[0].x - amp * 0.35, y: top - 120 };
  const finish = { x: cx, y: nodes[count - 1].y + step + FINISH_RUN };
  const pts = [start, ...nodes, finish];

  // Catmull-Rom to cubic Bezier
  const segs: [Pt, Pt, Pt, Pt][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.5;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * (t * 2), y: p1.y + ((p2.y - p0.y) / 6) * (t * 2) };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * (t * 2), y: p2.y - ((p3.y - p1.y) / 6) * (t * 2) };
    segs.push([p1, c1, c2, p2]);
  }

  let d = `M${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
  for (const [, c1, c2, p2] of segs) {
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  // lengths by sampling
  const at = (s: [Pt, Pt, Pt, Pt], u: number): Pt => {
    const [a, b, c, e] = s;
    const v = 1 - u;
    return {
      x: v * v * v * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u * u * u * e.x,
      y: v * v * v * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u * u * u * e.y,
    };
  };
  let length = 0;
  const nodeLen: number[] = [];
  const ys: number[] = [start.y];
  const lens: number[] = [0];
  segs.forEach((s, si) => {
    let prev = s[0];
    for (let k = 1; k <= 24; k++) {
      const p = at(s, k / 24);
      length += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
      if (p.y > ys[ys.length - 1]) {
        ys.push(p.y);
        lens.push(length);
      }
    }
    if (si < count) nodeLen.push(length); // end of segment si is node si
  });

  return { width, height: finish.y + FINISH_TAIL, step, amp, nodes, d, length, nodeLen, ys, lens, start, finish };
}

// ---------------------------------------------------------------- landmarks

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One landmark on the trail, in content space: `x`/`width` its box, `ground` the y it stands on. */
export interface LandmarkPlacement<Id extends string = string> {
  id: Id;
  x: number;
  width: number;
  height: number;
  ground: number;
  /** Its box, for keeping the small scenery props clear of it. */
  box: Rect;
}

export interface LandmarkArt {
  width: number;
  height: number;
  /** y (art units) the drawing stands on. */
  ground: number;
  /** How much of its width may run off the screen edge (0..1). */
  peek: number;
}

const TRAIL_R = 26;
const MARGIN = 10;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * What a landmark must stay clear of: the trail, every node and every caption. Not the coach:
 * it stands beside the current week only and is drawn in front, so when it reaches a landmark it
 * stands by it (and the landmarks never move as the weeks go by).
 */
function obstacles(trail: TrailLayout, captions: Rect[]): Rect[] {
  const { nodes, start, finish } = trail;
  const out: Rect[] = captions.map((c) => ({ x: c.x - 8, y: c.y - 8, w: c.w + 16, h: c.h + 16 }));
  for (const p of nodes) out.push({ x: p.x - NODE / 2 - 6, y: p.y - NODE / 2 - 6, w: NODE + 12, h: NODE + 12 });
  // the finish flag, its caption and the coach beside it at the end
  out.push({ x: finish.x - 130, y: finish.y - 70, w: 260, h: 140 });
  // the trail itself, as short boxes along straight runs between its points (it bows a little
  // between nodes, so the boxes are generous)
  const pts = [start, ...nodes, finish];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      out.push({ x: x - TRAIL_R - 8, y: y - TRAIL_R, w: (TRAIL_R + 8) * 2, h: TRAIL_R * 2 });
    }
  }
  return out;
}

/**
 * Landmarks between weeks: one in each chosen gap, on the side the trail leaves free. The
 * biggest size that clears every obstacle wins (largest first, nudged up and down within the
 * gap); a gap with no room gets nothing. Pure and deterministic, so a landmark never jumps.
 */
export function layoutLandmarks<Id extends string>(
  trail: TrailLayout,
  plan: { gap: number; id: Id }[],
  art: Record<Id, LandmarkArt>,
  /** The week captions' boxes, as the screen lays them out (see `captionBox`). */
  captions: Rect[],
): LandmarkPlacement<Id>[] {
  const { width, nodes } = trail;
  const avoid = obstacles(trail, captions);
  const out: LandmarkPlacement<Id>[] = [];
  for (const { gap, id } of plan) {
    if (gap < 0 || gap >= nodes.length - 1) continue;
    const a = nodes[gap];
    const b = nodes[gap + 1];
    const midY = (a.y + b.y) / 2;
    const trailX = (a.x + b.x) / 2;
    const A = art[id];
    const sides = trailX > width / 2 ? ['left', 'right'] : ['right', 'left'];
    let placed: LandmarkPlacement<Id> | null = null;
    search: for (let scale = 1; scale >= 0.45; scale -= 0.05) {
      const w = width * 0.56 * scale;
      const h = (w * A.height) / A.width;
      // the drawing's visible box: from its top down to where it stands (ground), plus a bit
      const standH = (h * A.ground) / A.height;
      for (const side of sides) {
        // flush with the edge first, then peeking in from beyond it (at most a third off-screen)
        for (const off of [0, 0.1, 0.2, 0.3].filter((o) => o <= A.peek)) {
          const x = side === 'left' ? MARGIN - w * (0.04 + off) : width - MARGIN - w * (0.96 - off);
          const x0 = Math.max(0, x + w * 0.06);
          const x1 = Math.min(width, x + w * 0.94);
          for (const dy of [0, -8, 8, -16, 16, -24, 24, -32, 32, -40, 40, -48, 48]) {
            const ground = midY + standH / 2 + dy;
            const box: Rect = { x: x0, y: ground - standH, w: x1 - x0, h: standH + 6 };
            if (avoid.some((o) => overlaps(box, o))) continue;
            placed = { id, x, width: w, height: h, ground, box };
            break search;
          }
        }
      }
    }
    if (placed) out.push(placed);
  }
  return out;
}

/**
 * A week caption's box, estimated from its text the way the Path lays it out: beside the node
 * on the side toward the middle (or below it when the coach takes that side), at most `room`
 * wide, the title up to two lines, the current week's subtitle under it. Generous on purpose:
 * it only keeps landmarks away.
 */
export function captionBox(
  p: Pt,
  width: number,
  text: { title: string; subtitle?: string },
  below: boolean,
): Rect {
  const labelLeft = p.x > width / 2;
  const room = Math.max(110, labelLeft ? p.x - NODE / 2 - 26 : width - p.x - NODE / 2 - 26);
  const long = text.title.length > 16;
  const titleW = text.title.length * (long ? 8.6 : 10.4);
  const subW = (text.subtitle?.length ?? 0) * 7;
  const w = Math.min(room, Math.max(70, titleW, subW) + 6);
  const titleLines = Math.min(2, Math.ceil(titleW / room));
  const subLines = text.subtitle ? Math.ceil(subW / room) : 0;
  const h = 18 + titleLines * (long ? 21 : 25) + subLines * 18 + 6;
  const top = below ? p.y + NODE / 2 + 14 : p.y - 26;
  const x = labelLeft ? p.x - NODE / 2 - 14 - w : p.x + NODE / 2 + 14;
  return { x, y: top, w, h };
}

/** Landscape bands: wavy ridgelines down the canvas. */
export interface Band {
  y: number;
  d: string;
  fill: string;
  /** Scenery standing on (or floating above) this ridge, in band space (crest line at y = 0). */
  props: Prop[];
  /** The last ridge: the meadow the finish flag stands in. */
  destination: boolean;
}

/**
 * Scenery motif per track. Leaders cross a savanna (acacias, sand); clinicians
 * follow a wetland (reeds, still pools, pale sage) — a watering hole being
 * where a herd goes to recover. Both end in the same warm meadow at the finish.
 */
export type Motif = 'savanna' | 'wetland';

export type PropKind = 'acacia' | 'reeds' | 'pool' | 'birds' | 'tuft';
export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  s: number;
  flip?: boolean;
}

/** Nominal band spacing, pt. Each band runs BAND_DEPTH below its crest, so every point is covered by two or three bands. */
export const BAND_GAP = 300;
/** Bands stretch to fit the course: spacing stays within this range. */
const GAP_MIN = 240;
const GAP_MAX = 360;
export const BAND_DEPTH = BAND_GAP * 2.4;
/** First ridge crest, pt from the top of the canvas (just under the sun). */
const FIRST_RIDGE = 210;
/** The destination ridge crests this far above the finish flag, so the flag stands in its meadow. */
const DEST_ABOVE = 64;
/** How far (pt) a ridge lags behind the trail by the time it reaches the top of the viewport. */
export const PARALLAX_DEPTH = 44;
/** Sun and birds in the sky: the farthest layer. Fraction of scroll they lag by. */
export const SKY_LAG = 0.35;

/**
 * Parallax lag for a ridge whose crest sits at `bandY` in content space.
 *
 * Depth comes from where a ridge is on screen, not from which band it is: the
 * top of the viewport is the horizon (the sky and sun are up there), so a ridge
 * lags more the higher it climbs, and ridges at the bottom move with the trail.
 * The lag is quadratic in screen position p (0 top, 1 bottom), so its rate
 * (≈ 2·D·(1.2 − p) / (1.44·H)) eases from ~1.5% of scroll at the bottom edge to
 * ~9% at the top: distant hills slow down, nearby ones keep pace, nothing sways.
 * Being screen-relative, it feels the same on an 8-week and a 12-week trail.
 *
 * No gaps: lag is capped at 2.25·D ≈ 99pt and neighbouring ridges differ by
 * < 0.85·D ≈ 37pt, far less than the ≥ 240pt gap minus the 80pt hill swing, and
 * every band runs 720pt below its crest, so a band never uncovers a hole.
 */
export function ridgeLag(bandY: number, scrollY: number, viewportH: number): number {
  'worklet';
  const p = Math.min(1.2, Math.max(-0.6, (bandY - scrollY) / viewportH));
  const q = (1.2 - p) / 1.2;
  return PARALLAX_DEPTH * q * q;
}

/** Ridge fills per motif: a pale horizon, alternating cool and earth tints, and the warm meadow at the finish. */
export interface BandPalette {
  horizon: string;
  cool: string[];
  earth: string[];
  meadow: string;
}

/**
 * Ridgelines from the horizon down to the finish. The spacing stretches (240 to
 * 360pt) so that, on any course length, a whole number of ridges fits and the
 * last one crests just above the finish flag: the trail always ends in a
 * meadow rather than mid-hill. Fills are laid out from the finish back so the
 * ridge before the meadow is always cool (a clear edge against the warm
 * meadow) and the first ridge is always the pale horizon.
 */
export function layoutBands(width: number, finishY: number, palette: BandPalette, motif: Motif, avoid: Rect[] = []): Band[] {
  const destY = finishY - DEST_ABOVE;
  const span = Math.max(1, destY - FIRST_RIDGE);
  let n = Math.max(1, Math.round(span / BAND_GAP));
  while (n > 1 && span / n < GAP_MIN) n--;
  while (span / n > GAP_MAX) n++;
  const gap = span / n;

  const bands: Band[] = [];
  for (let i = 0; i <= n; i++) {
    const y = FIRST_RIDGE + i * gap;
    const destination = i === n;
    const phase = (i * 1.7) % 3;
    const hill = (x: number) => 26 * Math.sin((x / width) * Math.PI * 1.6 + phase) + 14 * Math.sin((x / width) * Math.PI * 3.3 + phase * 2);
    let d = `M0 ${hill(0).toFixed(1)}`;
    const steps = 12;
    for (let k = 1; k <= steps; k++) {
      const x0 = ((k - 1) / steps) * width;
      const x1 = (k / steps) * width;
      const xm = (x0 + x1) / 2;
      d += ` Q${xm.toFixed(1)} ${hill(xm).toFixed(1)} ${x1.toFixed(1)} ${hill(x1).toFixed(1)}`;
    }
    d += ` L${width} ${BAND_DEPTH} L0 ${BAND_DEPTH} Z`;

    // fills: horizon first, meadow last, cool/earth alternating back from the meadow
    const fromEnd = n - i; // 1 = the ridge before the meadow
    const fill = destination
      ? palette.meadow
      : i === 0
        ? palette.horizon
        : fromEnd % 2 === 1
          ? palette.cool[((fromEnd - 1) / 2) % palette.cool.length]
          : palette.earth[(fromEnd / 2 - 1) % palette.earth.length];

    const on = (fx: number, kind: PropKind, s: number, dy = 0, flip?: boolean): Prop => {
      const x = fx * width;
      return { kind, x, y: hill(x) + dy, s, flip };
    };
    const props: Prop[] = [];
    if (destination) props.push(...destinationProps(motif, on));
    else if (i > 0) props.push(...ridgeProps(motif, i, width, on));
    // small props make way for the landmarks (content space, ignoring the ridge's parallax lag)
    const clear = avoid.length
      ? props.filter((p) => !avoid.some((r) => p.x > r.x - 30 && p.x < r.x + r.w + 30 && y + p.y > r.y - 80 && y + p.y < r.y + r.h + 60))
      : props;
    bands.push({ y, d, fill, props: clear, destination });
  }
  return bands;
}

type Place = (fx: number, kind: PropKind, s: number, dy?: number, flip?: boolean) => Prop;

/** Scenery along the way: at the edges, clear of the trail, one or two things per ridge at most. */
function ridgeProps(motif: Motif, i: number, width: number, on: Place): Prop[] {
  const out: Prop[] = [];
  if (motif === 'savanna') {
    if (i % 3 === 1) out.push(on(0.07, 'acacia', 0.75, -2));
    if (i % 4 === 2) out.push(on(0.94, 'acacia', 0.65, -2));
  } else {
    if (i % 3 === 1) out.push(on(0.06, 'reeds', 0.8, 1));
    if (i % 4 === 2) {
      out.push(on(0.9, 'pool', 0.85, 34));
      out.push(on(0.97, 'reeds', 0.6, 1, true));
    }
    if (i % 4 === 0) out.push(on(0.95, 'reeds', 0.55, 1, true));
  }
  if (i % 5 === 3) out.push({ kind: 'birds', x: 0.62 * width, y: -70, s: 1 });
  return out;
}

/** The finish: a gateway either side of the flag (the coach waits on its left). */
function destinationProps(motif: Motif, on: Place): Prop[] {
  // grass tufts in the meadow itself, below the flag's caption, so the trail's end has ground under it
  const tufts = [on(0.2, 'tuft', 1, 150), on(0.34, 'tuft', 0.8, 196), on(0.7, 'tuft', 0.9, 168), on(0.86, 'tuft', 0.75, 214)];
  if (motif === 'savanna') {
    return [on(0.1, 'acacia', 0.7, -2), on(0.86, 'acacia', 1, -2), on(0.95, 'acacia', 0.6, 0), ...tufts];
  }
  return [on(0.08, 'reeds', 0.75, 1), on(0.8, 'pool', 1.15, 40), on(0.93, 'reeds', 0.9, 1, true), on(0.68, 'reeds', 0.5, 44), ...tufts];
}
