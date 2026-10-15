/**
 * Calendar rules for the streak and the weekly goal. Days are the learner's local
 * calendar days as `YYYY-MM-DD` (strings compare in date order); weeks start on
 * Monday. Everything here is pure: the caller passes "today", so the app uses the
 * device's day and the server merge never needs a clock (or a timezone).
 */

export type DayKey = string;

export interface Streak {
  days: number;
  lastPracticeDay: DayKey | null;
}

export interface WeeklyGoal {
  target: number;
  done: number;
  hitCount: number;
}

/** The weekly goal's fields, with the Monday of the week `weekDays` and `done` belong to. */
export interface PracticeWeek {
  /** Monday of the week `weekDays` and `weeklyGoal.done` count. null before any practice. */
  weekStart: DayKey | null;
  /** Monday-start: which days that week had practice. */
  weekDays: boolean[];
  weeklyGoal: WeeklyGoal;
}

const pad = (n: number) => `${n}`.padStart(2, "0");

/** The local calendar day of a moment. */
export function dayKey(d: Date = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A day key at a local wall-clock time. Noon by default: clear of DST shifts at midnight. */
export function dayAt(day: DayKey, hour = 12, minute = 0): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

const parseDay = (day: DayKey) => dayAt(day);

export function isDayKey(v: unknown): v is DayKey {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** The calendar day `n` days after `day` (negative: before). */
export function addDays(day: DayKey, n: number): DayKey {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Monday-start index 0..6 of a day. */
export function weekdayOf(day: DayKey): number {
  return (parseDay(day).getDay() + 6) % 7;
}

/** The Monday that starts `day`'s week. */
export function weekStartOf(day: DayKey): DayKey {
  return addDays(day, -weekdayOf(day));
}

/** Whole calendar days from `a` to `b` (b - a). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** Time zones span 26 hours, so a flight can set the local date back at most two days. */
const MAX_DAYS_BACK = 2;

/**
 * The day a practice on `today` counts for: today, or the last practice day when the clock
 * reads up to two days earlier than it (a flight west). So no day counts twice and a run
 * never moves backwards. A last practice further ahead came from a clock that was wrong,
 * and doesn't hold later practice to its day. The reminder plan reads a future practice the same way.
 */
export function practiceDay(today: DayKey, lastPracticeDay: DayKey | null): DayKey {
  if (!lastPracticeDay || lastPracticeDay <= today) return today;
  return daysBetween(today, lastPracticeDay) <= MAX_DAYS_BACK ? lastPracticeDay : today;
}

const emptyWeekDays = () => Array.from({ length: 7 }, () => false);

// ---------------------------------------------------------------------------
// Streak freezes
// ---------------------------------------------------------------------------

/** Most freezes a learner can hold. Earning one at the cap is wasted. */
export const MAX_FREEZES = 2;
/** Every learner starts holding one. */
export const START_FREEZES = 1;

/**
 * The freeze ledger. The count held is never stored: it is replayed from these days
 * (`freezesHeld`), so two devices' ledgers merge by union and a merge can neither spend
 * the same freeze twice nor hand a spent one back.
 */
export interface StreakFreezes {
  /** Days the weekly goal was hit, each earning a freeze. At most one per week counts. */
  earnedDays: DayKey[];
  /** Missed days a freeze covered. */
  usedDays: DayKey[];
}

export const noFreezeHistory = (): StreakFreezes => ({ earnedDays: [], usedDays: [] });

/** The ledger with duplicates dropped and days sorted; only a week's first earn counts. */
function tidyFreezes(f: StreakFreezes): StreakFreezes {
  const weeks = new Set<DayKey>();
  const earnedDays: DayKey[] = [];
  for (const d of [...new Set(f.earnedDays)].sort()) {
    const w = weekStartOf(d);
    if (weeks.has(w)) continue;
    weeks.add(w);
    earnedDays.push(d);
  }
  return { earnedDays, usedDays: [...new Set(f.usedDays)].sort() };
}

/** Freezes held: start with 1, then every earn (capped at 2) and use, in day order. */
export function freezesHeld(f: StreakFreezes): number {
  const t = tidyFreezes(f);
  // a use sorts before an earn on the same day (it can't happen: an earn needs practice)
  const events = [...t.usedDays.map((d) => [d, 0] as const), ...t.earnedDays.map((d) => [d, 1] as const)].sort((a, b) =>
    a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1,
  );
  let held = START_FREEZES;
  for (const [, earn] of events) held = earn ? Math.min(MAX_FREEZES, held + 1) : Math.max(0, held - 1);
  return held;
}

/** The ledger after hitting the weekly goal on `today`. Hitting it again the same week earns nothing. */
export function freezesAfterGoalHit(f: StreakFreezes, today: DayKey): StreakFreezes {
  const week = weekStartOf(today);
  if (f.earnedDays.some((d) => weekStartOf(d) === week)) return f;
  return { ...f, earnedDays: [...f.earnedDays, today] };
}

/** Two devices' ledgers: every earn and every use either one saw. Commutative. */
export function mergeFreezes(a: StreakFreezes, b: StreakFreezes): StreakFreezes {
  return tidyFreezes({ earnedDays: [...a.earnedDays, ...b.earnedDays], usedDays: [...a.usedDays, ...b.usedDays] });
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/**
 * Covers the days missed since the last practice, one at a time and oldest first, with
 * the freezes held. Days already frozen stay frozen. The first day with no freeze left
 * breaks the streak; a freeze spent before that stays spent, as it would have been had
 * the app been opened that day. So the result doesn't depend on when the app is opened.
 * `used` lists the days frozen by this call.
 */
export function settleFreezes(
  streak: Streak,
  freezes: StreakFreezes,
  today: DayKey,
): { alive: boolean; freezes: StreakFreezes; used: DayKey[] } {
  const last = streak.lastPracticeDay;
  if (!last || streak.days <= 0) return { alive: false, freezes, used: [] };
  const frozen = new Set(freezes.usedDays);
  let held = freezesHeld(freezes);
  const used: DayKey[] = [];
  let alive = true;
  for (let d = addDays(last, 1); d < today; d = addDays(d, 1)) {
    if (frozen.has(d)) continue;
    if (held === 0) {
      alive = false;
      break;
    }
    held--;
    used.push(d);
  }
  return { alive, freezes: used.length ? { ...freezes, usedDays: [...freezes.usedDays, ...used] } : freezes, used };
}

/** The streak to show on `today`: 0 once a whole day has passed without practice or a freeze to cover it. */
export function liveStreakDays(streak: Streak, today: DayKey, freezes: StreakFreezes): number {
  return settleFreezes(streak, freezes, today).alive ? streak.days : 0;
}

/**
 * The streak after practising on `today`: same day keeps it, the day after extends it,
 * a gap the freezes cover extends it (frozen days don't add to the count), any other gap
 * restarts it. A clock that reads before the last practice counts as that day
 * (`practiceDay`). Returns the ledger with the frozen days recorded.
 */
export function streakAfterPractice(
  streak: Streak,
  today: DayKey,
  freezes: StreakFreezes,
): { streak: Streak; freezes: StreakFreezes; used: DayKey[] } {
  const day = practiceDay(today, streak.lastPracticeDay);
  if (streak.lastPracticeDay === day && streak.days > 0) return { streak, freezes, used: [] };
  const settled = settleFreezes(streak, freezes, day);
  const days = settled.alive ? streak.days + 1 : 1;
  return { streak: { days, lastPracticeDay: day }, freezes: settled.freezes, used: settled.used };
}

/** The first practice day of the run ending on `lastPracticeDay`, stepping over frozen days. */
function runStart(s: Streak, frozen: Set<DayKey>): DayKey {
  let d = s.lastPracticeDay!;
  for (let left = s.days - 1; left > 0; ) {
    d = addDays(d, -1);
    if (!frozen.has(d)) left--;
  }
  return d;
}

/** The first day of the run ending on `lastPracticeDay` (frozen days bridge it). null with no run. */
export function streakRunStart(s: Streak, frozenDays: readonly DayKey[] = []): DayKey | null {
  if (!s.lastPracticeDay || s.days <= 0) return null;
  return runStart(s, new Set(frozenDays));
}

/** The last day the run covers: its last practice, plus the frozen days straight after it. */
function coveredThrough(s: Streak, frozen: Set<DayKey>): DayKey {
  let d = s.lastPracticeDay!;
  while (frozen.has(addDays(d, 1))) d = addDays(d, 1);
  return d;
}

/**
 * Two devices' streaks for the same learner. Each is a run of practice days ending on
 * its `lastPracticeDay`, with `frozenDays` (the merged ledger's used days) bridging the
 * days a freeze covered. Runs that overlap or touch join into one (a device that
 * restarted at 1 without seeing the other's practice yesterday gets the full run);
 * otherwise the later run wins, so a stale copy never brings a broken streak back.
 * Frozen days don't count toward `days`. Commutative, and needs no clock.
 */
export function mergeStreaks(a: Streak, b: Streak, frozenDays: readonly DayKey[] = []): Streak {
  const aRun = a.lastPracticeDay && a.days > 0;
  const bRun = b.lastPracticeDay && b.days > 0;
  if (!aRun || !bRun) {
    if (aRun) return a;
    if (bRun) return b;
    return (a.lastPracticeDay ?? "") >= (b.lastPracticeDay ?? "") ? a : b;
  }
  const frozen = new Set(frozenDays);
  const [early, late] = a.lastPracticeDay! <= b.lastPracticeDay! ? [a, b] : [b, a];
  const lateStart = runStart(late, frozen);
  if (coveredThrough(early, frozen) < addDays(lateStart, -1)) return late;
  const earlyStart = runStart(early, frozen);
  const start = earlyStart < lateStart ? earlyStart : lateStart;
  const end = late.lastPracticeDay!;
  let frozenInRun = 0;
  for (const d of frozen) if (d > start && d < end) frozenInRun++;
  return { days: daysBetween(start, end) + 1 - frozenInRun, lastPracticeDay: end };
}

/**
 * Opening the app: spend freezes on the days missed (`settleFreezes`), then pick out the
 * frozen days this device hasn't shown the learner yet. That's the past week's frozen days
 * after `seenThrough` (the latest one already shown here), including ones another device
 * spent. `seenThrough` moves past them whether or not they're shown: a freeze that couldn't
 * save the streak isn't news (the streak at 0 says enough), so `reveal` is null then.
 * `reveal.pips` marks the days of today's week (Monday-start) whose pip plays the ice reveal;
 * a frozen day in last week only gets the note.
 */
export function freezeReveal(
  streak: Streak,
  freezes: StreakFreezes,
  seenThrough: DayKey | null,
  today: DayKey,
): {
  settled: ReturnType<typeof settleFreezes>;
  seenThrough: DayKey | null;
  reveal: { days: DayKey[]; pips: boolean[]; held: number } | null;
} {
  const settled = settleFreezes(streak, freezes, today);
  const since = [seenThrough ?? "", addDays(today, -8)].sort()[1];
  const days = [...new Set(settled.freezes.usedDays)].filter((d) => d > since && d < today).sort();
  if (!days.length) return { settled, seenThrough, reveal: null };
  const monday = weekStartOf(today);
  const pips = Array.from({ length: 7 }, (_, i) => days.includes(addDays(monday, i)));
  return {
    settled,
    seenThrough: days[days.length - 1],
    reveal: settled.alive ? { days, pips, held: freezesHeld(settled.freezes) } : null,
  };
}

// ---------------------------------------------------------------------------
// Weekly goal
// ---------------------------------------------------------------------------

/**
 * The weekly goal as of `today`: the stored week if it is this week, else an empty week
 * (same target, same weeks-hit count). A clock that reads the week before the stored one
 * (a flight west over Sunday midnight) keeps it. Returns the input itself when nothing changes.
 */
export function weekAsOf<T extends PracticeWeek>(w: T, today: DayKey): T {
  const start = weekStartOf(today);
  if (w.weekStart === start || (w.weekStart && start < w.weekStart && daysBetween(start, w.weekStart) <= 7)) return w;
  return { ...w, weekStart: start, weekDays: emptyWeekDays(), weeklyGoal: { ...w.weeklyGoal, done: 0 } };
}

/** The weekly goal after practising on `today`. `justHit` is true on the practice that reaches the target. */
export function weekAfterPractice<T extends PracticeWeek>(w: T, today: DayKey): T & { justHit: boolean } {
  const cur = weekAsOf(w, today);
  const weekDays = [...cur.weekDays];
  weekDays[weekdayOf(today)] = true;
  const done = cur.weeklyGoal.done + 1;
  const justHit = done === cur.weeklyGoal.target;
  return {
    ...cur,
    weekDays,
    weeklyGoal: { ...cur.weeklyGoal, done, hitCount: cur.weeklyGoal.hitCount + (justHit ? 1 : 0) },
    justHit,
  };
}

/**
 * Two devices' weeks: the later week wins; the same week combines (days practised on
 * either, the higher count). Weeks hit only climbs. `target` comes from `prefer`'s side.
 */
export function mergeWeeks(prefer: PracticeWeek, other: PracticeWeek): PracticeWeek {
  const p = prefer.weekStart ?? "";
  const o = other.weekStart ?? "";
  const hitCount = Math.max(prefer.weeklyGoal.hitCount, other.weeklyGoal.hitCount);
  const target = prefer.weeklyGoal.target || other.weeklyGoal.target;
  if (p !== o) {
    const win = p > o ? prefer : other;
    return { weekStart: win.weekStart, weekDays: [...win.weekDays], weeklyGoal: { target, done: win.weeklyGoal.done, hitCount } };
  }
  return {
    weekStart: prefer.weekStart,
    weekDays: Array.from({ length: 7 }, (_, i) => !!prefer.weekDays[i] || !!other.weekDays[i]),
    weeklyGoal: { target, done: Math.max(prefer.weeklyGoal.done, other.weeklyGoal.done), hitCount },
  };
}
