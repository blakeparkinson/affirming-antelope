/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HAPTIC_MASK_MS, createHapticGate } from '../src/lib/hapticGate';

describe('haptic gate', () => {
  it('plays a light haptic when nothing heavy came before', () => {
    assert.equal(createHapticGate().light(0), true);
  });

  it('drops a light haptic inside the mask after a heavy one', () => {
    const g = createHapticGate();
    g.heavy(1000);
    assert.equal(g.light(1000), false);
    assert.equal(g.light(1000 + HAPTIC_MASK_MS - 1), false);
  });

  it('plays a light haptic once the mask has passed', () => {
    const g = createHapticGate();
    g.heavy(1000);
    assert.equal(g.light(1000 + HAPTIC_MASK_MS), true);
  });

  it('never lets light haptics mask each other (a run of pip ticks keeps its rhythm)', () => {
    const g = createHapticGate();
    for (let t = 0; t < 1000; t += 110) assert.equal(g.light(t), true);
  });

  it('times the mask from the latest heavy haptic', () => {
    const g = createHapticGate();
    g.heavy(0);
    g.heavy(150);
    assert.equal(g.light(200), false);
    assert.equal(g.light(150 + HAPTIC_MASK_MS), true);
  });

  it('a light haptic before a heavy one does not hold the heavy one back', () => {
    const g = createHapticGate();
    assert.equal(g.light(0), true);
    assert.equal(g.heavy(10), true);
  });
});
