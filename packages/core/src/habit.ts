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

/** A day key as a local date at noon (clear of DST shifts at midnight). */
function parseDay(day: DayKey): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

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

const emptyWeekDays = () => Array.from({ length: 7 }, () => false);

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/** The streak to show on `today`: 0 once a whole day has passed without practice. */
export function liveStreakDays(streak: Streak, today: DayKey): number {
  const last = streak.lastPracticeDay;
  if (!last || streak.days <= 0) return 0;
  return last === today || last === addDays(today, -1) ? streak.days : 0;
}

/** The streak after practising on `today`: same day keeps it, the day after extends it, a gap restarts it. */
export function streakAfterPractice(streak: Streak, today: DayKey): Streak {
  const last = streak.lastPracticeDay;
  if (last === today && streak.days > 0) return streak;
  const days = liveStreakDays(streak, today) > 0 ? streak.days + 1 : 1;
  return { days, lastPracticeDay: today };
}

/**
 * Two devices' streaks for the same learner. Each is a run of consecutive practice days
 * ending on its `lastPracticeDay`. Runs that overlap or touch join into one (a device
 * that restarted at 1 without seeing the other's practice yesterday gets the full run);
 * otherwise the later run wins, so a stale copy never brings a broken streak back.
 * Commutative, and needs no clock.
 */
export function mergeStreaks(a: Streak, b: Streak): Streak {
  const aRun = a.lastPracticeDay && a.days > 0;
  const bRun = b.lastPracticeDay && b.days > 0;
  if (!aRun || !bRun) {
    if (aRun) return a;
    if (bRun) return b;
    return (a.lastPracticeDay ?? "") >= (b.lastPracticeDay ?? "") ? a : b;
  }
  const [early, late] = a.lastPracticeDay! <= b.lastPracticeDay! ? [a, b] : [b, a];
  const lateStart = addDays(late.lastPracticeDay!, -(late.days - 1));
  if (early.lastPracticeDay! < addDays(lateStart, -1)) return late;
  const earlyStart = addDays(early.lastPracticeDay!, -(early.days - 1));
  const start = earlyStart < lateStart ? earlyStart : lateStart;
  return { days: daysBetween(start, late.lastPracticeDay!) + 1, lastPracticeDay: late.lastPracticeDay };
}

// ---------------------------------------------------------------------------
// Weekly goal
// ---------------------------------------------------------------------------

/**
 * The weekly goal as of `today`: the stored week if it is this week, else an empty week
 * (same target, same weeks-hit count). Returns the input itself when nothing changes.
 */
export function weekAsOf<T extends PracticeWeek>(w: T, today: DayKey): T {
  const start = weekStartOf(today);
  if (w.weekStart === start) return w;
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
