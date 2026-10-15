import type { SkillId, SkillLevelNumber } from '@antelope/core';

/** A streak milestone waiting for, or playing, its full-screen moment. */
export interface MilestoneMoment {
  kind: 'milestone';
  milestone: number;
  /** The streak before the practice that crossed it: the number rolls up from here. */
  from: number;
}

/** A skill that a practice moved up a level. */
export interface LevelUpMoment {
  kind: 'level-up';
  skill: SkillId;
  from: SkillLevelNumber;
  to: SkillLevelNumber;
  /** How far through the old level the skill was before the practice, 0..100: the ring sweeps on from here. */
  fromPercent: number;
  /** How far through the new level it is now, 0..100: the new ring fills to here. */
  toPercent: number;
}

export type Moment = MilestoneMoment | LevelUpMoment;

/** Completion moments play one at a time in this order: the streak first, then the skill. */
const ORDER: Record<Moment['kind'], number> = { milestone: 0, 'level-up': 1 };

export interface MomentQueue {
  /** Waiting their turn, in play order. */
  pending: Moment[];
  /** On screen now. */
  showing: Moment | null;
}

export const EMPTY_QUEUE: MomentQueue = { pending: [], showing: null };

/**
 * Add a moment in its place. One of each kind waits at a time: a later milestone replaces an
 * earlier one, and a skill that levels again before its moment played folds into one level-up
 * (from the earliest level to the latest), so nothing plays twice.
 */
export function enqueue(q: MomentQueue, m: Moment): MomentQueue {
  let next = m;
  const rest: Moment[] = [];
  for (const p of q.pending) {
    if (p.kind === 'milestone' && next.kind === 'milestone') continue;
    if (p.kind === 'level-up' && next.kind === 'level-up') {
      if (p.skill === next.skill) {
        next = { ...next, from: p.from, fromPercent: p.fromPercent };
        continue;
      }
    }
    rest.push(p);
  }
  // stable: same-kind moments for different skills keep their arrival order
  const pending = [...rest, next].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  return { ...q, pending };
}

/** Put the next moment on screen, unless one is already showing or something else holds the screen. */
export function release(q: MomentQueue, held = false): MomentQueue {
  if (held || q.showing || !q.pending.length) return q;
  const [showing, ...pending] = q.pending;
  return { pending, showing };
}

/** The moment on screen is done. The next one waits for its own `release`. */
export function dismiss(q: MomentQueue): MomentQueue {
  return q.showing ? { ...q, showing: null } : q;
}
