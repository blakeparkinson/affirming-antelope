/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { captionBox, captionGap, HILL_SWING, layoutBands, layoutTrail, MAX_RIDGE_LAG, NODE, onSky, ridgeLag } from '../src/components/path/geometry';

const SUBTITLE = 'What MI is, why it works, and what it can do for you as a leader.';
const palette = { horizon: '#fff', cool: ['#eee'], earth: ['#ddd'], meadow: '#ccc' };

describe('Path captions by the sky', () => {
  for (const [width, weeks] of [
    [320, 12],
    [375, 12],
    [375, 8],
    [520, 12],
  ] as const) {
    // the screen lays the trail out from 150pt under the header (76pt on web)
    const trail = layoutTrail(width, weeks, 76 + 150);

    it(`backs week 1's caption on the sky and leaves week 2's on the hills (${width}pt, ${weeks} weeks)`, () => {
      assert.equal(onSky(trail.nodes[0].y - 26), true);
      assert.equal(onSky(trail.nodes[1].y - 26), false);
    });

    it(`keeps every week's caption, as the current week, on screen and off its node (${width}pt, ${weeks} weeks)`, () => {
      trail.nodes.forEach((p, i) => {
        const box = captionBox(p, width, { title: 'Engaging and OARS', subtitle: SUBTITLE }, false, true);
        assert.ok(box.x >= 0 && box.x + box.w <= width, `week ${i + 1}: ${box.x}..${box.x + box.w}`);
        const gap = captionGap(p, width, true);
        assert.ok(gap >= 14 && gap <= 20);
        assert.ok(box.x + box.w <= p.x - NODE / 2 - gap + 0.5 || box.x >= p.x + NODE / 2 + gap - 0.5, `week ${i + 1} overlaps its node`);
      });
    });
  }

  it('keeps the current caption 20pt out, where the breathing ring (1.55x, fading) is nearly gone, when there is room', () => {
    assert.equal(captionGap({ x: 260, y: 300 }, 520, true), 20);
    assert.equal(captionGap({ x: 260, y: 300 }, 520, false), 14);
  });

  it('bounds the sky by the ridge’s real swing and lag', () => {
    // the hills never rise or dip past HILL_SWING around the crest line
    for (const b of layoutBands(375, 3000, palette, 'savanna')) {
      const ys = [...b.d.matchAll(/[MQL]\s?([\d.]+)\s(-?[\d.]+)/g)].map((m) => Number(m[2])).filter((y) => y < 300);
      assert.ok(Math.max(...ys.map(Math.abs)) <= HILL_SWING + 0.1);
    }
    // the most a ridge lags, scrolled far past it
    assert.ok(Math.abs(ridgeLag(210, 100000, 800) - MAX_RIDGE_LAG) < 1e-9);
    assert.ok(ridgeLag(210, 0, 800) <= MAX_RIDGE_LAG);
  });
});
