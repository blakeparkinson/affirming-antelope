import { addDays, dayKey, daysBetween, isDayKey, streakRunStart, weekStartOf, type DayKey, type PracticeWeek, type Streak } from "./habit";
import { SKILLS } from "./skills";
import { warmthArc, type WarmthPoint } from "./warmth";
import type { DemoSkillProgress } from "./demo";
import type { ActivityKind, SkillId, Stance, Turn, TurnAnnotation } from "./types";

/**
 * The weekly recap: on the first open of a new (Monday-start, local) week, Home shows
 * last week back to the learner. Everything here reads what the device already holds
 * (the practice log, the role-play transcripts, the skill levels): no API call, and no
 * line the learner didn't type. Pure: the caller passes the week and the clock.
 */

/** One finished practice, as the app's practice log keeps it. */
export interface RecapPractice {
  kind: ActivityKind;
  skill?: SkillId;
  minutes: number;
  /** ISO timestamp. Counted on the device's local day. */
  at: string;
}

/** A finished role-play, as the app keeps it (the learner's own transcript). */
export interface RecapRoleplay {
  id: string;
  /** ScenarioSpec id. */
  refId: string;
  transcript: Turn[];
  /** The reviewer's read of each line, when the debrief came back. */
  annotations?: TurnAnnotation[];
  /** The scenario's starting stance, for the opening line's warmth. */
  start?: Stance;
  /** ISO timestamp. The role-play counts for the week it ended in. */
  endedAt: string;
}

export interface RecapSkillMove {
  skill: SkillId;
  reps: number;
  minutes: number;
}

export interface RecapNextSkill {
  skill: SkillId;
  level: DemoSkillProgress["level"];
  percent: number;
}

export interface RecapRoleplayBest {
  sessionId: string;
  refId: string;
  /** Counterpart lines played in change (or read as change talk by the reviewer). */
  changeTalk: number;
  /** Warmth at the end minus warmth at the start, -2..2. */
  warmthRise: number;
  arc: WarmthPoint[];
  /** The learner's own reply just before they first opened up. Absent when there's none stored. */
  line?: string;
}

export interface WeeklyRecap {
  /** Monday of the week recapped. */
  weekStart: DayKey;
  /** Monday-start: which days had practice. */
  days: boolean[];
  daysPracticed: number;
  reps: number;
  /** From this device's log only: 0 when the week's practice happened on another device. */
  minutes: number;
  /** The skill practised most (reps, then minutes, then curriculum order). null with no skill practice. */
  topSkill: RecapSkillMove | null;
  /** The weakest unlocked skill (lowest level and percent), to work on next. null when none is unlocked. */
  nextSkill: RecapNextSkill | null;
  /** The week's best role-play. null when there was none. */
  bestRoleplay: RecapRoleplayBest | null;
  /** No practice at all: the "fresh start" version, with no stats. */
  empty: boolean;
}

const localDay = (iso: string): DayKey | null => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : dayKey(new Date(t));
};

/** 0..6 for a day inside the week starting `monday`, else -1. */
function indexIn(monday: DayKey, day: DayKey | null): number {
  if (!day || day < monday || day > addDays(monday, 6)) return -1;
  return daysBetween(monday, day);
}

const curriculumIndex = (id: SkillId) => SKILLS.findIndex((s) => s.id === id);

/** Counterpart lines in change: the stance it was played in, or the reviewer's read. */
function changeTalkOf(r: RecapRoleplay): number {
  const read = new Map((r.annotations ?? []).map((a) => [a.turnId, a]));
  return r.transcript.filter((t) => t.speaker === "employee" && isChange(t, read.get(t.id))).length;
}

const isChange = (t: Turn, a: TurnAnnotation | undefined) => t.stance === "change" || a?.stance === "change" || a?.talk === "change";

/** The learner's reply right before the counterpart first opened up, if it's stored. */
function turningLine(r: RecapRoleplay): string | undefined {
  const read = new Map((r.annotations ?? []).map((a) => [a.turnId, a]));
  const first = r.transcript.findIndex((t) => t.speaker === "employee" && isChange(t, read.get(t.id)));
  if (first <= 0) return undefined;
  for (let i = first - 1; i >= 0; i--) {
    const t = r.transcript[i];
    if (t.speaker !== "learner") continue;
    const text = t.text.trim();
    return text || undefined;
  }
  return undefined;
}

function bestOf(roleplays: readonly RecapRoleplay[]): RecapRoleplayBest | null {
  let best: (RecapRoleplayBest & { endedAt: string }) | null = null;
  for (const r of roleplays) {
    const arc = warmthArc(r.transcript, { start: r.start, annotations: r.annotations });
    const warmthRise = arc.length >= 2 ? arc[arc.length - 1].warmth - arc[0].warmth : 0;
    const changeTalk = changeTalkOf(r);
    const better =
      !best ||
      changeTalk > best.changeTalk ||
      (changeTalk === best.changeTalk && (warmthRise > best.warmthRise || (warmthRise === best.warmthRise && r.endedAt > best.endedAt)));
    if (!better) continue;
    const line = turningLine(r);
    best = { sessionId: r.id, refId: r.refId, changeTalk, warmthRise, arc, endedAt: r.endedAt, ...(line ? { line } : {}) };
  }
  if (!best) return null;
  const { endedAt: _drop, ...out } = best;
  return out;
}

/**
 * Last week (or any week) in review. `log` is the practice log (any order, any weeks);
 * `skills` the learner's skill levels now. Records outside the week starting `weekStart`
 * are ignored. Options:
 *   roleplays  the role-plays kept on this device (the best one, and the learner's line)
 *   week       the synced practice week: when it is the week recapped, its days and count
 *              fill in practice done on another device (whose log this device doesn't have)
 *   streak     the synced streak and its frozen days: once practice this week has moved the
 *              stored week on, the run still says which of last week's days had practice
 */
export function buildWeeklyRecap(
  log: readonly RecapPractice[],
  skills: Partial<Record<SkillId, DemoSkillProgress>>,
  weekStart: DayKey,
  {
    roleplays = [],
    week,
    streak,
    frozenDays = [],
  }: { roleplays?: readonly RecapRoleplay[]; week?: PracticeWeek; streak?: Streak; frozenDays?: readonly DayKey[] } = {},
): WeeklyRecap {
  const monday = weekStartOf(weekStart);
  const days = Array.from({ length: 7 }, () => false);
  let reps = 0;
  let minutes = 0;
  const bySkill = new Map<SkillId, RecapSkillMove>();
  for (const r of log) {
    const i = indexIn(monday, localDay(r.at));
    if (i < 0) continue;
    days[i] = true;
    reps += 1;
    const m = Number.isFinite(r.minutes) && r.minutes > 0 ? r.minutes : 0;
    minutes += m;
    if (r.skill) {
      const s = bySkill.get(r.skill) ?? { skill: r.skill, reps: 0, minutes: 0 };
      bySkill.set(r.skill, { ...s, reps: s.reps + 1, minutes: s.minutes + m });
    }
  }
  const topSkill =
    [...bySkill.values()].sort((a, b) => b.reps - a.reps || b.minutes - a.minutes || curriculumIndex(a.skill) - curriculumIndex(b.skill))[0] ?? null;

  let nextSkill: RecapNextSkill | null = null;
  for (const { id } of SKILLS) {
    const p = skills[id];
    if (!p || p.status === "locked") continue;
    // lowest level, then least of the way through it; ties keep curriculum order
    if (!nextSkill || p.level * 1000 + p.percent < nextSkill.level * 1000 + nextSkill.percent) nextSkill = { skill: id, level: p.level, percent: p.percent };
  }

  if (week?.weekStart === monday) {
    week.weekDays.forEach((on, i) => {
      if (on && i < 7) days[i] = true;
    });
    reps = Math.max(reps, week.weeklyGoal.done);
  }
  // every day of the streak's run was practised, except the days a freeze covered
  const runStart = streak ? streakRunStart(streak, frozenDays) : null;
  if (streak?.lastPracticeDay && runStart) {
    const frozen = new Set(frozenDays);
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      if (d >= runStart && d <= streak.lastPracticeDay && !frozen.has(d)) days[i] = true;
    }
  }
  // at least one rep for each day known to have practice
  reps = Math.max(reps, days.filter(Boolean).length);
  const inWeek = roleplays.filter((r) => indexIn(monday, localDay(r.endedAt)) >= 0 && r.transcript.length > 0);
  const daysPracticed = days.filter(Boolean).length;
  return {
    weekStart: monday,
    days,
    daysPracticed,
    reps,
    minutes,
    topSkill,
    nextSkill,
    bestRoleplay: bestOf(inWeek),
    empty: reps === 0 && daysPracticed === 0,
  };
}

// ---------------------------------------------------------------------------
// When to show it: once per week, on whichever device opens first.
// ---------------------------------------------------------------------------

/** The Monday of the week before `today`'s: the week the recap looks back on. */
export function recapWeekFor(today: DayKey): DayKey {
  return addDays(weekStartOf(today), -7);
}

/**
 * Should Home show the recap on `today`? Not when it was already shown this week (on any
 * device: `seenWeek` is synced), and not for a learner with no practice before this week
 * (a brand-new install has nothing to look back on). `practiceDays` is any days known to
 * have practice (the log's days, the streak's last day).
 */
export function shouldShowRecap({
  seenWeek,
  today,
  practiceDays,
}: {
  seenWeek: DayKey | null | undefined;
  today: DayKey;
  practiceDays: readonly (DayKey | null | undefined)[];
}): boolean {
  const monday = weekStartOf(today);
  // a later week already seen (a clock that went back) counts as seen too
  if (isDayKey(seenWeek) && seenWeek >= monday) return false;
  return practiceDays.some((d) => isDayKey(d) && d < monday);
}

/** Two devices' recap marks: the later week wins. Commutative. */
export function mergeRecapSeen(a: DayKey | null | undefined, b: DayKey | null | undefined): DayKey | null {
  const x = isDayKey(a) ? a : null;
  const y = isDayKey(b) ? b : null;
  if (!x) return y;
  if (!y) return x;
  return x > y ? x : y;
}

// ---------------------------------------------------------------------------
// Storyboard (the app plays it; kept here so reduced motion is tested)
// ---------------------------------------------------------------------------

export interface RecapMotion {
  /** The stats count up from 0 (false: they're set, no roll). */
  countUp: boolean;
  /** ms before the first number rolls. */
  countDelay: number;
  /** ms between one stat's roll and the next. */
  stagger: number;
  /** The warmth arc draws itself left to right (false: it's there at once, faded in). */
  drawArc: boolean;
  /** ms before the arc starts drawing. */
  arcDelay: number;
}

/**
 *   t 0      the sheet rises; stats are at 0
 *   t 350    days practised rolls up, then reps (+120), then minutes (+240)
 *   t 900    the best role-play's warmth arc draws, a bead riding its edge
 * Reduced motion: everything is in place on open (a cross-fade), nothing rolls or draws.
 */
export function recapMotion(reduce: boolean): RecapMotion {
  if (reduce) return { countUp: false, countDelay: 0, stagger: 0, drawArc: false, arcDelay: 0 };
  return { countUp: true, countDelay: 350, stagger: 120, drawArc: true, arcDelay: 900 };
}
