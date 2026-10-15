/*
 * The coach bounding along the Path when a week unlocks: two or three equal hops that
 * follow the trail's own curve from the finished week to the new one.
 *
 * Pure and deterministic. `planBound` bakes the whole move into a frame table (feet
 * position, squash, lean) that the app's UI thread only looks up, so the arcs can be
 * tested here: every hop the same length, height and air time; the feet never move while
 * they touch the ground (no sliding); and the whole bound stays well under two seconds.
 *
 *   crouch   anticipation from standing, squash down, push off             (120ms)
 *   air      parabola over the trail; stretch on take-off, round at the
 *            apex, a small reach before touch-down; lean into the travel   (300ms; 340 for 2 hops)
 *   contact  between hops: absorb the landing and push off again, feet
 *            planted                                                        (110ms)
 *   land     the last touch-down: a deeper squash, a small rebound, settle  (260ms)
 */

export interface BoundPt {
  x: number;
  y: number;
}

export interface BoundPose {
  /** Feet (bottom centre of the body), in the path's space. */
  x: number;
  y: number;
  /** Vertical scale of the body about its feet. Width follows as 1/sqrt(sy) (volume kept). */
  sy: number;
  /** Lean into the travel direction, degrees (positive leans right). */
  lean: number;
}

export interface BoundPlan {
  hops: number;
  /** ms from the start of the crouch. */
  takeoffs: number[];
  landings: number[];
  /** Where each hop lands (feet). The last one is the end of the path. */
  spots: BoundPt[];
  /** Apex height above the trail, pt. The same for every hop. */
  height: number;
  /** Arc length of one hop, pt. */
  hopLen: number;
  /** The last landing. */
  arrive: number;
  /** Settled after the last landing: the bound is over. */
  end: number;
  /** Frame spacing of `frames`, ms. */
  step: number;
  /** Flat [x, y, sy, lean] per frame, frame i at i·step ms. */
  frames: number[];
}

export const BOUND_CROUCH = 120;
export const BOUND_CONTACT = 110;
export const BOUND_LAND = 260;
export const BOUND_LEAN = 6;
const FRAME = 1000 / 120;

/** Air time per hop: three quick hops, or two slightly longer ones on a short path. */
export function boundAir(hops: number): number {
  return hops >= 3 ? 300 : 340;
}

/** Hop count for a path this long: two on a short run, three otherwise. */
export function boundHops(length: number): number {
  return length < 160 ? 2 : 3;
}

export function polylineLength(path: BoundPt[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return len;
}

/** The point at fraction `f` (0..1) of the path's arc length. */
export function pointAlong(path: BoundPt[], f: number): BoundPt {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1 || f <= 0) return { ...path[0] };
  const total = polylineLength(path);
  if (f >= 1 || total === 0) return { ...path[path.length - 1] };
  let want = f * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= d) {
      const u = d === 0 ? 0 : want / d;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    want -= d;
  }
  return { ...path[path.length - 1] };
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Squash while the feet are planted: down fast (peak about a third in), back up as it pushes off. */
function contactSquash(v: number, depth: number): number {
  return 1 - depth * Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, v)), 0.65));
}

/** Stretch in the air: long just after take-off, round at the apex, a slight reach before landing. */
function airStretch(u: number): number {
  if (u < 0.55) return 1 + 0.13 * Math.sin((Math.PI * u) / 0.55);
  return 1 + 0.05 * Math.sin((Math.PI * (u - 0.55)) / 0.45);
}

/** The last landing: squash hard, rebound a touch past standing, settle. */
function landSquash(v: number): number {
  if (v < 0.28) return 1 - 0.22 * Math.sin((Math.PI / 2) * (v / 0.28));
  if (v < 0.68) return 0.78 + 0.26 * smooth((v - 0.28) / 0.4);
  return 1.04 - 0.04 * smooth((v - 0.68) / 0.32);
}

/** The pose at `t` ms. Before the crouch it stands at the start; after `end`, at the end. */
export function boundPose(plan: Omit<BoundPlan, "frames">, path: BoundPt[], t: number): BoundPose {
  const { hops, takeoffs, landings, height, arrive } = plan;
  const air = boundAir(hops);
  const end = pointAlong(path, 1);
  if (t <= 0) return { ...pointAlong(path, 0), sy: 1, lean: 0 };
  if (t < takeoffs[0]) return { ...pointAlong(path, 0), sy: contactSquash(t / BOUND_CROUCH, 0.14), lean: 0 };
  if (t >= arrive) {
    const v = Math.min(1, (t - arrive) / BOUND_LAND);
    return { ...end, sy: landSquash(v), lean: 0 };
  }
  for (let k = 0; k < hops; k++) {
    if (t < landings[k]) {
      // in the air on hop k
      const u = (t - takeoffs[k]) / air;
      const g = pointAlong(path, (k + u) / hops);
      const a = pointAlong(path, k / hops);
      const b = pointAlong(path, (k + 1) / hops);
      const dir = Math.sign(b.x - a.x);
      return {
        x: g.x,
        y: g.y - height * 4 * u * (1 - u),
        sy: airStretch(u),
        lean: dir * BOUND_LEAN * Math.sin(Math.PI * u),
      };
    }
    if (k + 1 < hops && t < takeoffs[k + 1]) {
      // planted between hop k and k+1
      const v = (t - landings[k]) / BOUND_CONTACT;
      return { ...pointAlong(path, (k + 1) / hops), sy: contactSquash(v, 0.2), lean: 0 };
    }
  }
  return { ...end, sy: 1, lean: 0 };
}

/**
 * Plans the bound along `path` (the feet's route, start to end, any sampling). Hops split
 * the path into equal arc lengths, so each hop is the same size and the feet move at one
 * steady speed along the curve while airborne.
 */
export function planBound(path: BoundPt[], opts: { hops?: number } = {}): BoundPlan {
  const length = polylineLength(path);
  const hops = opts.hops ?? boundHops(length);
  const air = boundAir(hops);
  const takeoffs: number[] = [];
  const landings: number[] = [];
  for (let k = 0; k < hops; k++) {
    const up = BOUND_CROUCH + k * (air + BOUND_CONTACT);
    takeoffs.push(up);
    landings.push(up + air);
  }
  const arrive = landings[hops - 1];
  const hopLen = length / hops;
  const height = Math.min(52, Math.max(26, hopLen * 0.38));
  const spots = landings.map((_, k) => pointAlong(path, (k + 1) / hops));
  const base = { hops, takeoffs, landings, spots, height, hopLen, arrive, end: arrive + BOUND_LAND, step: FRAME };
  const frames: number[] = [];
  const n = Math.ceil(base.end / FRAME);
  for (let i = 0; i <= n; i++) {
    const p = boundPose(base, path, Math.min(base.end, i * FRAME));
    frames.push(p.x, p.y, p.sy, p.lean);
  }
  return { ...base, frames };
}
