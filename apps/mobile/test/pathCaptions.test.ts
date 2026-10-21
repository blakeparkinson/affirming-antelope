/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { captionBox, captionGap, layoutTrail, NODE, onSky } from '../src/components/path/geometry';

describe('Path captions by the sky', () => {
  for (const [width, weeks] of [
    [375, 12],
    [375, 8],
    [520, 12],
  ] as const) {
    // the screen lays the trail out from 150pt under the header (75pt on web)
    const trail = layoutTrail(width, weeks, 75 + 150);

    it(`backs week 1's caption on the sky and leaves week 2's on the hills (${width}pt, ${weeks} weeks)`, () => {
      assert.equal(onSky(trail.nodes[0].y - 26), true);
      assert.equal(onSky(trail.nodes[1].y - 26), false);
    });

    it(`keeps the current week's caption, backing included, inside the screen (${width}pt, ${weeks} weeks)`, () => {
      const p = trail.nodes[0];
      const box = captionBox(p, width, { title: 'Overview', subtitle: 'What MI is, why it works, and what it can do for you as a leader.' }, false, true);
      assert.ok(box.x >= 12 - 0.5, `starts at ${box.x}`);
      assert.ok(box.x + box.w <= width - 12 + 0.5, `ends at ${box.x + box.w}`);
      // clear of the node and its breathing ring
      const nodeLeft = p.x - NODE / 2;
      const nodeRight = p.x + NODE / 2;
      assert.ok(box.x + box.w <= nodeLeft - captionGap(true) + 0.5 || box.x >= nodeRight + captionGap(true) - 0.5);
    });
  }
});
