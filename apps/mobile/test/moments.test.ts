/// <reference types="node" />
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { EMPTY_QUEUE, dismiss, enqueue, release, type LevelUpMoment, type MilestoneMoment, type MomentQueue } from '../src/state/momentQueue';
import { NEXT_MOMENT_AFTER, useMoments } from '../src/state/moments';

const streak = (milestone: number, from = milestone - 1): MilestoneMoment => ({ kind: 'milestone', milestone, from });
const level = (skill: LevelUpMoment['skill'], from: LevelUpMoment['from'], to: LevelUpMoment['to'], fromPercent = 90, toPercent = 4): LevelUpMoment => ({
  kind: 'level-up',
  skill,
  from,
  to,
  fromPercent,
  toPercent,
});
const kinds = (q: MomentQueue) => q.pending.map((m) => m.kind);

describe('moment queue order', () => {
  it('plays a streak milestone before a level-up, whichever was queued first', () => {
    const a = enqueue(enqueue(EMPTY_QUEUE, level('oars', 1, 2)), streak(7));
    const b = enqueue(enqueue(EMPTY_QUEUE, streak(7)), level('oars', 1, 2));
    assert.deepEqual(kinds(a), ['milestone', 'level-up']);
    assert.deepEqual(a, b);
  });

  it('never shows two at once: release while one is showing does nothing', () => {
    let q = enqueue(enqueue(EMPTY_QUEUE, level('oars', 1, 2)), streak(3));
    q = release(q);
    assert.equal(q.showing?.kind, 'milestone');
    assert.equal(release(q), q);
    q = release(dismiss(q));
    assert.equal(q.showing?.kind, 'level-up');
    assert.deepEqual(q.pending, []);
    q = release(dismiss(q));
    assert.equal(q.showing, null);
  });

  it('holds everything while something else has the screen (the weekly recap)', () => {
    const q = enqueue(EMPTY_QUEUE, streak(3));
    assert.equal(release(q, true), q);
  });

  it('releasing an empty queue or dismissing nothing is a no-op', () => {
    assert.equal(release(EMPTY_QUEUE), EMPTY_QUEUE);
    assert.equal(dismiss(EMPTY_QUEUE), EMPTY_QUEUE);
  });

  it('keeps one milestone: a later one replaces the earlier', () => {
    const q = enqueue(enqueue(EMPTY_QUEUE, streak(3)), streak(7));
    assert.deepEqual(q.pending, [streak(7)]);
  });

  it('folds two level-ups of the same skill into one, from the first level to the last', () => {
    const q = enqueue(enqueue(EMPTY_QUEUE, level('oars', 1, 2, 95, 3)), level('oars', 2, 3, 98, 1));
    assert.deepEqual(q.pending, [level('oars', 1, 3, 95, 1)]);
  });

  it('queues the same level-up twice (double record) as one', () => {
    const q = enqueue(enqueue(EMPTY_QUEUE, level('oars', 1, 2)), level('oars', 1, 2));
    assert.deepEqual(q.pending, [level('oars', 1, 2)]);
  });

  it('keeps level-ups of different skills in arrival order, after the milestone', () => {
    const q = enqueue(enqueue(enqueue(EMPTY_QUEUE, level('oars', 1, 2)), level('evoking', 3, 4)), streak(14));
    assert.deepEqual(
      q.pending.map((m) => (m.kind === 'level-up' ? m.skill : m.kind)),
      ['milestone', 'oars', 'evoking'],
    );
  });

  it('a moment queued while another is showing waits its turn', () => {
    let q = release(enqueue(EMPTY_QUEUE, level('oars', 1, 2)));
    q = enqueue(q, streak(3));
    assert.equal(q.showing?.kind, 'level-up');
    assert.deepEqual(kinds(q), ['milestone']);
  });
});

describe('useMoments', () => {
  beforeEach(() => {
    useMoments.setState({ pending: [], showing: null, recap: null, levelled: [] });
  });

  it('after the milestone closes, the level-up follows on its own after a beat', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const m = useMoments.getState();
      m.queue(level('oars', 1, 2));
      m.queue(streak(7));
      m.release();
      assert.equal(useMoments.getState().showing?.kind, 'milestone');
      useMoments.getState().dismiss();
      assert.equal(useMoments.getState().showing, null);
      mock.timers.tick(NEXT_MOMENT_AFTER - 1);
      assert.equal(useMoments.getState().showing, null);
      mock.timers.tick(1);
      assert.equal(useMoments.getState().showing?.kind, 'level-up');
      useMoments.getState().dismiss();
      mock.timers.tick(NEXT_MOMENT_AFTER);
      assert.equal(useMoments.getState().showing, null);
    } finally {
      mock.timers.reset();
    }
  });

  it('a recap that opens before the next beat holds the level-up until it closes', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const m = useMoments.getState();
      m.queue(streak(3));
      m.queue(level('oars', 1, 2));
      m.release();
      useMoments.getState().dismiss();
      useMoments.getState().showRecap({ weekStart: '2026-10-05' });
      mock.timers.tick(NEXT_MOMENT_AFTER);
      assert.equal(useMoments.getState().showing, null);
      useMoments.getState().closeRecap(true);
      assert.equal(useMoments.getState().showing?.kind, 'level-up');
    } finally {
      mock.timers.reset();
    }
  });

  it('marks a levelled skill once for the Me tab glow, until Me shows it', () => {
    const m = useMoments.getState();
    m.queue(level('oars', 1, 2));
    m.queue(level('oars', 1, 2));
    m.queue(streak(3));
    assert.deepEqual(useMoments.getState().levelled, ['oars']);
    useMoments.getState().clearLevelled();
    assert.deepEqual(useMoments.getState().levelled, []);
  });
});
