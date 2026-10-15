import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BOUND_CONTACT,
  boundHops,
  planBound,
  pointAlong,
  polylineLength,
  type BoundPlan,
  type BoundPt,
} from "../src/bounds";

/** A trail-like S curve between two weeks, ~240pt of arc. */
function curve(n = 40): BoundPt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return { x: 120 + 110 * Math.sin(u * Math.PI * 0.9), y: 300 + 172 * u };
  });
}

const frame = (p: BoundPlan, i: number) => ({ x: p.frames[i * 4], y: p.frames[i * 4 + 1], sy: p.frames[i * 4 + 2], lean: p.frames[i * 4 + 3] });
const frameCount = (p: BoundPlan) => p.frames.length / 4;
const framesBetween = (p: BoundPlan, a: number, b: number) => {
  const out = [];
  for (let i = 0; i < frameCount(p); i++) {
    const t = i * p.step;
    if (t >= a && t <= b) out.push(frame(p, i));
  }
  return out;
};

describe("pointAlong", () => {
  it("walks the polyline by arc length", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    assert.deepEqual(pointAlong(path, 0), { x: 0, y: 0 });
    assert.deepEqual(pointAlong(path, 0.25), { x: 10, y: 0 });
    assert.deepEqual(pointAlong(path, 0.5), { x: 10, y: 10 });
    assert.deepEqual(pointAlong(path, 1), { x: 10, y: 30 });
  });

  it("copes with an empty or one-point path", () => {
    assert.deepEqual(pointAlong([], 0.5), { x: 0, y: 0 });
    assert.deepEqual(pointAlong([{ x: 3, y: 4 }], 0.5), { x: 3, y: 4 });
  });
});

describe("boundHops", () => {
  it("hops twice on a short run and three times otherwise", () => {
    assert.equal(boundHops(120), 2);
    assert.equal(boundHops(159), 2);
    assert.equal(boundHops(160), 3);
    assert.equal(boundHops(400), 3);
  });
});

describe("planBound", () => {
  const path = curve();
  const plan = planBound(path);

  it("goes from the start of the path to its end", () => {
    const first = frame(plan, 0);
    const last = frame(plan, frameCount(plan) - 1);
    assert.ok(Math.abs(first.x - path[0].x) < 1e-6 && Math.abs(first.y - path[0].y) < 1e-6);
    assert.ok(Math.abs(last.x - path[path.length - 1].x) < 1e-6 && Math.abs(last.y - path[path.length - 1].y) < 1e-6);
    assert.ok(Math.abs(last.sy - 1) < 1e-6 && last.lean === 0);
  });

  it("makes three equal hops on a week-to-week run, landing on the curve", () => {
    assert.equal(plan.hops, 3);
    const len = polylineLength(path);
    let prev = path[0];
    let along = 0;
    plan.spots.forEach((s, k) => {
      along += plan.hopLen;
      const want = pointAlong(path, along / len);
      assert.ok(Math.hypot(s.x - want.x, s.y - want.y) < 1e-6, `hop ${k} lands on the curve`);
      prev = s;
    });
    assert.deepEqual(prev, pointAlong(path, 1));
  });

  it("gives every hop the same air time and apex height (consistent arcs)", () => {
    const airs = plan.landings.map((l, k) => l - plan.takeoffs[k]);
    assert.ok(airs.every((a) => a === airs[0]));
    // apex: the frame nearest mid-air, measured against the ground under it
    const apexes = plan.takeoffs.map((t0, k) => {
      const mid = (t0 + plan.landings[k]) / 2;
      const f = frame(plan, Math.round(mid / plan.step));
      const ground = pointAlong(path, (k + 0.5) / plan.hops);
      return ground.y - f.y;
    });
    for (const a of apexes) assert.ok(Math.abs(a - plan.height) < 1, `apex ${a.toFixed(2)} vs ${plan.height}`);
  });

  it("never slides the feet while they touch the ground", () => {
    const planted = [
      [0, plan.takeoffs[0]],
      ...plan.landings.slice(0, -1).map((l, k) => [l, plan.takeoffs[k + 1]]),
      [plan.arrive, plan.end],
    ];
    for (const [a, b] of planted) {
      const fs = framesBetween(plan, a + 0.01, b - 0.01);
      assert.ok(fs.length > 3);
      for (const f of fs) {
        assert.ok(Math.abs(f.x - fs[0].x) < 1e-9 && Math.abs(f.y - fs[0].y) < 1e-9, `feet moved between ${a} and ${b}`);
        assert.equal(f.lean, 0);
      }
    }
    assert.equal(plan.takeoffs[1] - plan.landings[0], BOUND_CONTACT);
  });

  it("squashes on take-off and landing, stretches in the air", () => {
    const crouch = Math.min(...framesBetween(plan, 0, plan.takeoffs[0]).map((f) => f.sy));
    const air = Math.max(...framesBetween(plan, plan.takeoffs[0], plan.landings[0]).map((f) => f.sy));
    const land = Math.min(...framesBetween(plan, plan.arrive, plan.end).map((f) => f.sy));
    assert.ok(crouch < 0.9, `crouch ${crouch}`);
    assert.ok(air > 1.1, `air ${air}`);
    assert.ok(land < 0.8, `land ${land}`);
    for (let i = 0; i < frameCount(plan); i++) {
      const { sy } = frame(plan, i);
      assert.ok(sy > 0.75 && sy < 1.2);
    }
  });

  it("leans into the direction of travel", () => {
    const k = 0;
    const mid = frame(plan, Math.round((plan.takeoffs[k] + plan.landings[k]) / 2 / plan.step));
    const dir = Math.sign(plan.spots[k].x - path[0].x);
    assert.equal(Math.sign(mid.lean), dir);
  });

  it("finishes well inside two seconds", () => {
    assert.ok(plan.end <= 1600, `bound runs ${plan.end}ms`);
    assert.ok(planBound(path, { hops: 2 }).end <= 1600);
  });

  it("takes two hops on a short path", () => {
    const short = planBound([
      { x: 0, y: 0 },
      { x: 60, y: 100 },
    ]);
    assert.equal(short.hops, 2);
    assert.equal(short.spots.length, 2);
  });
});
