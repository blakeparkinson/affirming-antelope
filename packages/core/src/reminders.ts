import { addDays, dayAt, dayKey, daysBetween, isDayKey, liveStreakDays, weekdayOf, type DayKey, type PracticeWeek, type Streak, type StreakFreezes } from "./habit";

/**
 * Practice reminders, planned on the device (no server). The app cancels everything
 * it scheduled and schedules `planReminders(...)` again whenever the inputs change
 * (a practice, a settings change, sign-out, the app coming to the foreground), so the
 * plan only has to be right for "nothing happens between now and then". Pure: the
 * caller passes the clock, so the plan is the same for the same inputs.
 *
 * Per day, counted from the last practice (L):
 *   L itself        nothing (they practiced)
 *   L+1, L+2        the daily reminder at the learner's time. On the day the streak
 *                   would end (L+1, or later when streak freezes cover the days before),
 *                   with a streak of 2 or more, it's the streak nudge instead, plus a
 *                   last call at 20:30 when their time is 18:30 or earlier.
 *   L+3             one "we miss you"
 *   after that      nothing until they practice again (pinging someone who left gets
 *                   notifications turned off)
 * Never practiced: nothing (the offer comes after the first practice).
 *
 * Mondays: "Your week in review is ready" at 09:00, when the week before had practice and
 * the recap hasn't been seen yet. It takes the place of that day's daily or lapse reminder
 * (one ping), but not a streak nudge or last call.
 */

export type ReminderKind = "daily" | "streak" | "last_call" | "lapse" | "recap";

export interface ReminderPrefs {
  on: boolean;
  /** Local time, 24h. */
  hour: number;
  minute: number;
}

export interface PlannedReminder {
  /** Stable per kind and day, so a re-plan of the same inputs is the same set. */
  id: string;
  kind: ReminderKind;
  day: DayKey;
  at: Date;
  title: string;
  body: string;
}

export const DEFAULT_REMINDER_TIME = { hour: 19, minute: 0 } as const;
export const LAST_CALL = { hour: 20, minute: 30 } as const;
/** Monday morning: the weekly recap is ready. */
export const RECAP_REMINDER = { hour: 9, minute: 0 } as const;
const RECAP_LINE: Line = { title: "Your week in review is ready", body: "See how last week went, and pick this week's focus." };
/** A last call only when the learner's own reminder is at least two hours before it. */
const LAST_CALL_LATEST_OWN = 18 * 60 + 30;
/** Days after the last practice that still get the daily reminder; the next gets the lapse. */
const DAILY_GAP_MAX = 2;
const LAPSE_GAP = 3;

export const REMINDER_ID_PREFIX = "aa-reminder";

/** The times the opt-in card and the Me row offer. */
export const REMINDER_TIMES: readonly { hour: number; minute: number }[] = [
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 19, minute: 0 },
  { hour: 21, minute: 0 },
];

type Line = { title: string; body: string };
type StreakLine = (n: number) => Line;

const DAILY: Line[] = [
  { title: "Two minutes, one reflection", body: "A quick rep keeps the skill warm." },
  { title: "Your next conversation is coming", body: "Practice the open question before you need it." },
  { title: "Quick one?", body: "One drill, two minutes. The antelope's ready when you are." },
  { title: "Listen first, then reflect", body: "Today's rep takes less time than a coffee." },
  { title: "Small reps, real change", body: "Two minutes today keeps the habit going." },
  { title: "Ready to practice?", body: "Try a reflection before your next real conversation." },
];

const STREAK: StreakLine[] = [
  (n) => ({ title: `Your ${n}-day streak ends tonight`, body: "One quick rep keeps it going." }),
  (n) => ({ title: `Keep your ${n}-day streak alive`, body: "Two minutes is all it takes today." }),
  (n) => ({ title: `Day ${n + 1} is waiting`, body: "Practice once today to keep your streak." }),
];

const LAST_CALL_LINES: StreakLine[] = [
  (n) => ({ title: `Last call for your ${n}-day streak`, body: "A two-minute drill still counts." }),
  (n) => ({ title: "Still time tonight", body: `Your ${n}-day streak ends at midnight.` }),
];

const LAPSE: Line[] = [
  { title: "We miss you", body: "Your skills are still here. Pick up with a two-minute drill." },
  { title: "Ready when you are", body: "No pressure. One rep gets you back in." },
];

/** The same line for the same day and kind, so re-planning doesn't reshuffle the copy. */
function pick<T>(lines: readonly T[], day: DayKey, kind: ReminderKind): T {
  let h = 0;
  for (const ch of `${kind}:${day}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[h % lines.length];
}

/** Does a reminder at this time get the 20:30 last call on a streak-at-risk day? */
export function hasLastCall(hour: number, minute: number): boolean {
  return hour * 60 + minute <= LAST_CALL_LATEST_OWN;
}

function validTime(p: ReminderPrefs): boolean {
  return Number.isInteger(p.hour) && Number.isInteger(p.minute) && p.hour >= 0 && p.hour < 24 && p.minute >= 0 && p.minute < 60;
}

export function planReminders({
  prefs,
  streak,
  freezes,
  now = new Date(),
  horizonDays = 7,
  recap,
}: {
  prefs: ReminderPrefs | undefined;
  streak: Streak;
  /** The freeze ledger: a day a freeze would cover isn't the day the streak ends. */
  freezes: StreakFreezes;
  now?: Date;
  horizonDays?: number;
  /**
   * Plan the Monday recap reminder. `week`: the stored practice week (synced), so it knows
   * whether the week before had practice. `seenWeek`: Monday of the week the recap was last
   * seen in (synced), so a week already seen gets none. Unset: no recap reminder.
   */
  recap?: { week?: Pick<PracticeWeek, "weekStart" | "weekDays">; seenWeek?: DayKey | null };
}): PlannedReminder[] {
  if (!prefs?.on || !validTime(prefs)) return [];
  const today = dayKey(now);
  const raw = streak.lastPracticeDay;
  if (!raw) return [];
  // a practice "in the future" (the clock moved back): treat it as today, as `practiceDay` does
  const last = raw > today ? today : raw;
  const run = { ...streak, lastPracticeDay: last };

  const out: PlannedReminder[] = [];
  const add = (kind: ReminderKind, day: DayKey, when: Date, line: Line) => {
    if (when.getTime() <= now.getTime()) return;
    out.push({ id: `${REMINDER_ID_PREFIX}:${kind}:${day}`, kind, day, at: when, ...line });
  };

  for (let i = 0; i < horizonDays; i++) {
    const day = addDays(today, i);
    const gap = daysBetween(last, day);
    if (gap <= 0) continue;
    if (gap > LAPSE_GAP) break;
    const own = dayAt(day, prefs.hour, prefs.minute);
    // the streak ends tonight: still alive today, gone tomorrow (no freeze left to cover today)
    const atRisk = streak.days >= 2 && liveStreakDays(run, day, freezes) > 0 && liveStreakDays(run, addDays(day, 1), freezes) === 0;
    if (gap === LAPSE_GAP && !atRisk) {
      add("lapse", day, own, pick(LAPSE, day, "lapse"));
      continue;
    }
    if (!atRisk) {
      if (gap <= DAILY_GAP_MAX) add("daily", day, own, pick(DAILY, day, "daily"));
      continue;
    }
    add("streak", day, own, pick(STREAK, day, "streak")(streak.days));
    if (hasLastCall(prefs.hour, prefs.minute)) {
      add("last_call", day, dayAt(day, LAST_CALL.hour, LAST_CALL.minute), pick(LAST_CALL_LINES, day, "last_call")(streak.days));
    }
  }

  const monday = recap ? recapReminderDay({ today, horizonDays, last, week: recap.week, recapSeenWeek: recap.seenWeek }) : null;
  const recapAt = monday ? dayAt(monday, RECAP_REMINDER.hour, RECAP_REMINDER.minute) : null;
  if (!monday || !recapAt || recapAt.getTime() <= now.getTime()) return out;
  const kept = out.filter((r) => !(r.day === monday && (r.kind === "daily" || r.kind === "lapse")));
  kept.push({ id: `${REMINDER_ID_PREFIX}:recap:${monday}`, kind: "recap", day: monday, at: recapAt, ...RECAP_LINE });
  return kept.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * The Monday within the horizon whose recap gets a reminder, or null: the week before it
 * had practice (the stored week's days, or the last practice falling in it) and its recap
 * hasn't been seen on any device.
 */
function recapReminderDay({
  today,
  horizonDays,
  last,
  week,
  recapSeenWeek,
}: {
  today: DayKey;
  horizonDays: number;
  last: DayKey;
  week?: Pick<PracticeWeek, "weekStart" | "weekDays">;
  recapSeenWeek?: DayKey | null;
}): DayKey | null {
  let monday: DayKey | null = null;
  for (let i = 0; i < horizonDays && !monday; i++) if (weekdayOf(addDays(today, i)) === 0) monday = addDays(today, i);
  if (!monday) return null;
  if (isDayKey(recapSeenWeek) && recapSeenWeek >= monday) return null;
  const before = addDays(monday, -7);
  const practiced = (week?.weekStart === before && week.weekDays.some(Boolean)) || (last >= before && last < monday);
  return practiced ? monday : null;
}

/** "7 pm", "12:30 pm": the reminder time as the Me row shows it. */
export function formatReminderTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "am" : "pm";
  return minute === 0 ? `${h12} ${suffix}` : `${h12}:${`${minute}`.padStart(2, "0")} ${suffix}`;
}

// ---------------------------------------------------------------------------
// The opt-in offer: after the first finished practice; "Not now" asks once more
// after the third; then never again (Me › Reminders is always there).
// ---------------------------------------------------------------------------

export const REMINDER_OFFER_AT = [1, 3] as const;

/** Should the completion screen offer reminders? `asks` is how many offers were answered. */
export function shouldOfferReminders({ asks, practices, on }: { asks: number; practices: number; on: boolean }): boolean {
  if (on) return false;
  const nextAt = REMINDER_OFFER_AT[asks];
  return nextAt !== undefined && practices >= nextAt;
}
