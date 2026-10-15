import { isDayKey, streakRunStart, type DayKey, type Streak } from "./habit";

/**
 * Streak milestones: the full-screen moment after a practice takes the streak across one
 * of these. Each plays once per run, on whichever device got there first: the celebration
 * is written to the synced document, so a second device that catches up on the same run
 * doesn't replay it. A broken streak starts a new run, and its milestones count again.
 */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

/** A milestone that played: the threshold, and the day it played (a practice day of that run). */
export interface MilestoneSeen {
  days: number;
  day: DayKey;
}

/** How many celebrations the document keeps (the latest). Plenty for one run's six. */
const KEEP = 24;

/** The highest milestone in (before, after], or null when the streak didn't cross one. */
export function milestoneCrossed(before: number, after: number): StreakMilestone | null {
  let hit: StreakMilestone | null = null;
  for (const m of STREAK_MILESTONES) if (m > before && m <= after) hit = m;
  return hit;
}

/**
 * The milestone to celebrate after a practice took the streak from `before` (the live
 * streak when the practice started) to `after`. null when none was crossed, or when this
 * run already celebrated it or a higher one (`seen` on or after the run's first day).
 * Several crossed at once (a merge joined two runs) celebrate only the highest.
 */
export function milestoneToCelebrate(
  before: number,
  after: Streak,
  seen: readonly MilestoneSeen[],
  frozenDays: readonly DayKey[] = [],
): StreakMilestone | null {
  const m = milestoneCrossed(before, after.days);
  if (!m) return null;
  const start = streakRunStart(after, frozenDays);
  if (start && seen.some((s) => s.days >= m && s.day >= start)) return null;
  return m;
}

/** Duplicates dropped, oldest first, the latest `KEEP`. */
function tidy(seen: readonly MilestoneSeen[]): MilestoneSeen[] {
  const byKey = new Map<string, MilestoneSeen>();
  for (const s of seen) byKey.set(`${s.day}|${s.days}`, { days: s.days, day: s.day });
  return [...byKey.values()].sort((a, b) => (a.day === b.day ? a.days - b.days : a.day < b.day ? -1 : 1)).slice(-KEEP);
}

/** The list after celebrating `m` on `day`. */
export function markMilestone(seen: readonly MilestoneSeen[], m: number, day: DayKey): MilestoneSeen[] {
  return tidy([...seen, { days: m, day }]);
}

/** Two devices' celebrations: every one either saw. Commutative. */
export function mergeMilestones(a: readonly MilestoneSeen[], b: readonly MilestoneSeen[]): MilestoneSeen[] {
  return tidy([...a, ...b]);
}

/** A stored list, keeping only well-formed entries. undefined when there's none to read. */
export function asMilestones(v: unknown): MilestoneSeen[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return tidy(
    v.filter(
      (x): x is MilestoneSeen =>
        !!x && typeof x === "object" && isDayKey((x as MilestoneSeen).day) && Number.isInteger((x as MilestoneSeen).days) && (x as MilestoneSeen).days > 0,
    ),
  );
}
