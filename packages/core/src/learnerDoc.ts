import { addDays, isDayKey, mergeFreezes, mergeStreaks, mergeWeeks, noFreezeHistory, weekStartOf, type StreakFreezes } from "./habit";
import { DEMO_LEARNER, freshLearnerState, type DemoLearnerState, type DemoSkillProgress } from "./demo";
import { DEFAULT_PATHWAY_ID, getPathway } from "./pathway";
import type { PathwayId, SkillId } from "./types";

/**
 * The learner progress document, shared by the app's persisted store (v3), the
 * `learner_state` row on the server, and the API's guest merge
 * (`/api/account/merge-anonymous`). Everything in here is pure, so the app and the
 * server merge with the exact same rules.
 *
 *   v2 (one pathway)    { pathwayId, currentWeek, completedActivityIds, pathSeenWeek, ...global }
 *   v3 (multi-pathway)  { activePathwayId, pathwayChosenAt, progress: { [pathwayId]: { currentWeek,
 *                         completedActivityIds, pathSeenWeek } }, ...global }
 *
 * Streak, weekly goal, skills and counts stay global: a reflection is the same skill
 * with a patient or a direct report.
 */

/** One pathway's place in its course. Kept per pathway, so switching tracks loses nothing. */
export interface PathwayProgress {
  /** 1..units, or units + 1 once the pathway is complete. */
  currentWeek: number;
  completedActivityIds: string[];
  /**
   * The week the Path screen last showed as current. When `currentWeek` moves
   * past it, Path plays the unlock choreography once and then marks it seen.
   */
  pathSeenWeek: number;
}

/** The part of the learner's state mirrored to `learner_state`. */
export interface SyncedDoc {
  firstName: string;
  role: string;
  /** The track Home, Path and Practice follow. */
  activePathwayId: PathwayId;
  /** When the learner last picked a track (ISO). null until the welcome's track step. */
  pathwayChosenAt: string | null;
  /** Course progress per pathway. */
  progress: Partial<Record<PathwayId, PathwayProgress>>;
  /** Global: a skill is the same skill in either setting. */
  skills: Record<SkillId, DemoSkillProgress>;
  /** Read it with `liveStreakDays`: `days` is the run ending on `lastPracticeDay`, which may be over. */
  streak: { days: number; lastPracticeDay: string | null };
  /** Streak freezes earned and used. The count held comes from `freezesHeld`. */
  freezes: StreakFreezes;
  /** Monday (YYYY-MM-DD) of the week `weekDays` and `weeklyGoal.done` count. Read them with `weekAsOf`. */
  weekStart: string | null;
  /** Monday-start: which days of `weekStart`'s week had practice. */
  weekDays: boolean[];
  weeklyGoal: { target: number; done: number; hitCount: number };
  scenariosCompleted: number;
}

export const SYNCED_KEYS = [
  "firstName",
  "role",
  "activePathwayId",
  "pathwayChosenAt",
  "progress",
  "skills",
  "streak",
  "freezes",
  "weekStart",
  "weekDays",
  "weeklyGoal",
  "scenariosCompleted",
] as const satisfies readonly (keyof SyncedDoc)[];

export const LEGACY_CHOSEN_AT = "2000-01-01T00:00:00.000Z";

export function isPathwayId(v: unknown): v is PathwayId {
  return v === "mi-for-leaders" || v === "mi-for-clinicians";
}

/** Before any practice: the course starts at week 1. */
export function emptyProgress(): PathwayProgress {
  return { currentWeek: 1, completedActivityIds: [], pathSeenWeek: 1 };
}

export function progressFrom(d: DemoLearnerState): PathwayProgress {
  const pathway = getPathway(d.pathwayId);
  const completed = [
    ...pathway.units.filter((u) => d.completedUnitIds.includes(u.id)).flatMap((u) => u.activities.map((a) => a.id)),
    ...d.currentUnitCompletedActivityIds,
  ];
  return { currentWeek: d.currentWeek, completedActivityIds: completed, pathSeenWeek: d.currentWeek };
}

/** A brand-new learner's synced document on a track. `chosenAt` is null until they pick one. */
export function freshSyncedDoc(pathwayId: PathwayId = DEFAULT_PATHWAY_ID, chosenAt: string | null = null): SyncedDoc {
  const d = freshLearnerState(pathwayId);
  return {
    firstName: "",
    role: "",
    activePathwayId: pathwayId,
    pathwayChosenAt: chosenAt,
    progress: { [pathwayId]: progressFrom({ ...d, currentWeek: Math.max(1, d.currentWeek) }) },
    skills: d.skills,
    streak: { days: d.streakDays, lastPracticeDay: null },
    freezes: noFreezeHistory(),
    weekStart: null,
    weekDays: Array.from({ length: 7 }, () => false),
    weeklyGoal: { target: d.weeklyGoal.target, done: d.weeklyGoal.done, hitCount: 0 },
    scenariosCompleted: 0,
  };
}

/**
 * The v2 seed nobody touched: every new install used to start as Amanda (week 4, a
 * 17-day streak, a sample assignment). Practising sets `lastPracticeDay`, so a seed
 * with no practice day, Amanda's name and her exact numbers was never used.
 */
export function isUntouchedLegacyDemo(raw: Record<string, unknown>): boolean {
  const streak = raw.streak as { days?: number; lastPracticeDay?: string | null } | undefined;
  const goal = raw.weeklyGoal as { done?: number } | undefined;
  return (
    raw.firstName === DEMO_LEARNER.user.firstName &&
    !!streak &&
    streak.days === DEMO_LEARNER.streakDays &&
    !streak.lastPracticeDay &&
    raw.currentWeek === DEMO_LEARNER.currentWeek &&
    raw.scenariosCompleted === 4 &&
    (goal?.done ?? DEMO_LEARNER.weeklyGoal.done) === DEMO_LEARNER.weeklyGoal.done
  );
}

const asProgress = (v: unknown): PathwayProgress | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Partial<PathwayProgress>;
  const week = typeof p.currentWeek === "number" && p.currentWeek >= 1 ? p.currentWeek : 1;
  return {
    currentWeek: week,
    completedActivityIds: Array.isArray(p.completedActivityIds)
      ? p.completedActivityIds.filter((x): x is string => typeof x === "string")
      : [],
    pathSeenWeek: typeof p.pathSeenWeek === "number" ? p.pathSeenWeek : week,
  };
};

const dayKeys = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isDayKey) : []);

/** A stored ledger, keeping only well-formed days. */
function asFreezes(v: unknown): StreakFreezes | undefined {
  if (!v || typeof v !== "object") return undefined;
  const f = v as Record<string, unknown>;
  return { earnedDays: dayKeys(f.earnedDays), usedDays: dayKeys(f.usedDays) };
}

/**
 * Any stored document (v2 or v3, local or from the server) → the v3 synced fields it
 * carries. Missing fields stay missing (the caller fills them from a fallback). An
 * untouched v2 demo seed comes back as a fresh learner who hasn't chosen a track.
 */
export function upgradeDoc(raw: unknown): Partial<SyncedDoc> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  if (!("progress" in r) && isUntouchedLegacyDemo(r)) return freshSyncedDoc("mi-for-leaders", null);
  const out: Partial<SyncedDoc> = {};
  for (const k of ["firstName", "role", "skills", "streak", "weekDays", "weeklyGoal", "scenariosCompleted"] as const) {
    if (r[k] !== undefined && r[k] !== null) (out as Record<string, unknown>)[k] = r[k];
  }
  // Before `weekStart` existed, the week counted was the one of the last practice (only practice
  // writes weekDays and done). Always set it alongside them, so a fallback's week is never borrowed.
  if (isDayKey(r.weekStart)) out.weekStart = r.weekStart;
  else if (out.weekDays || out.weeklyGoal) {
    const last = (r.streak as { lastPracticeDay?: unknown } | undefined)?.lastPracticeDay;
    out.weekStart = isDayKey(last) ? weekStartOf(last) : null;
  }
  // Documents from before freezes have no ledger; the fallback's fills in (an empty one holds the starting freeze).
  const freezes = asFreezes(r.freezes);
  if (freezes) out.freezes = freezes;
  if (r.progress && typeof r.progress === "object") {
    const progress: SyncedDoc["progress"] = {};
    for (const [id, v] of Object.entries(r.progress as Record<string, unknown>)) {
      const p = asProgress(v);
      if (isPathwayId(id) && p) progress[id] = p;
    }
    out.progress = progress;
    if (isPathwayId(r.activePathwayId)) out.activePathwayId = r.activePathwayId;
    if (typeof r.pathwayChosenAt === "string" || r.pathwayChosenAt === null) out.pathwayChosenAt = r.pathwayChosenAt as string | null;
  } else if (typeof r.currentWeek === "number") {
    // v2: one pathway's progress at the top level, and it was in use (so the track counts as chosen)
    const id: PathwayId = isPathwayId(r.pathwayId) ? r.pathwayId : "mi-for-leaders";
    out.progress = { [id]: asProgress(r)! };
    out.activePathwayId = id;
    out.pathwayChosenAt = LEGACY_CHOSEN_AT;
  }
  return out;
}

/**
 * What goes to `learner_state`: the v3 document plus the v2 fields mirrored from MI for
 * Leaders, so an older app version on another device still sees its own course.
 */
export function toRemoteDoc(s: SyncedDoc): Record<string, unknown> {
  const leaders = s.progress["mi-for-leaders"] ?? emptyProgress();
  return {
    ...s,
    shape: 3,
    pathwayId: "mi-for-leaders",
    currentWeek: leaders.currentWeek,
    completedActivityIds: leaders.completedActivityIds,
    pathSeenWeek: leaders.pathSeenWeek,
  };
}

export function mergeProgress(a: PathwayProgress | undefined, b: PathwayProgress | undefined): PathwayProgress {
  if (!a) return b ?? emptyProgress();
  if (!b) return a;
  return {
    currentWeek: Math.max(a.currentWeek, b.currentWeek),
    completedActivityIds: Array.from(new Set([...b.completedActivityIds, ...a.completedActivityIds])),
    pathSeenWeek: Math.max(a.pathSeenWeek, b.pathSeenWeek),
  };
}

/** Skill levels only climb. */
export function skillRank(p: DemoSkillProgress) {
  return p.status === "locked" ? -1 : p.level * 1000 + p.percent;
}

export function fillSkills(
  base: Record<SkillId, DemoSkillProgress>,
  over: Partial<Record<SkillId, DemoSkillProgress>> | undefined,
): Record<SkillId, DemoSkillProgress> {
  return { ...base, ...(over ?? {}) };
}

// ---------------------------------------------------------------------------
// Merge. Every rule is order-independent: merge(a, b) == merge(b, a) for the fields
// that matter. Course progress only moves forward; the streak and the weekly goal
// follow the calendar rules in `habit.ts` (a stale copy never revives a broken
// streak or last week's count).
// Documents are upgraded on read (`upgradeDoc`): v2 (one pathway at the top level)
// becomes v3 (progress per pathway), and an untouched v2 demo seed becomes fresh.
// ---------------------------------------------------------------------------

function mergeSkills(a: SyncedDoc["skills"], b: Partial<SyncedDoc["skills"]> | undefined): SyncedDoc["skills"] {
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b) as SkillId[]) {
    const theirs = b[k];
    if (!theirs) continue;
    const mine = out[k];
    out[k] = !mine || skillRank(theirs) > skillRank(mine) ? theirs : mine;
  }
  return out;
}

function mergeAllProgress(a: SyncedDoc["progress"], b: SyncedDoc["progress"]): SyncedDoc["progress"] {
  const out: SyncedDoc["progress"] = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<PathwayId>) out[id] = mergeProgress(a[id], b[id]);
  return out;
}

/** The track picked most recently wins (a pick beats no pick); ties go to the account's copy. */
export function laterChoice<T extends Pick<SyncedDoc, "activePathwayId" | "pathwayChosenAt">>(
  local: T,
  remote: T,
): Pick<SyncedDoc, "activePathwayId" | "pathwayChosenAt"> {
  const l = local.pathwayChosenAt ?? "";
  const r = remote.pathwayChosenAt ?? "";
  const pick = l > r ? local : remote;
  return { activePathwayId: pick.activePathwayId, pathwayChosenAt: pick.pathwayChosenAt };
}

/** Fill gaps in a server document (older app versions, the seed) from local defaults. */
export function normalizeSynced<T extends SyncedDoc>(remote: unknown, fallback: T): T {
  const r = upgradeDoc(remote);
  const out = { ...fallback } as Record<string, unknown>;
  for (const k of SYNCED_KEYS) if (r[k] !== undefined) out[k] = r[k];
  const s = out as T;
  s.skills = fillSkills(fallback.skills, r.skills);
  return s;
}

/**
 * A device that hadn't seen the other's practice yet can freeze a day that was practised
 * (the tablet opens before the phone's practice syncs). That freeze was never needed: drop it.
 */
function withoutPracticedDays(f: StreakFreezes, practiced: (string | null)[]): StreakFreezes {
  const days = new Set(practiced.filter(isDayKey));
  return f.usedDays.some((d) => days.has(d)) ? { ...f, usedDays: f.usedDays.filter((d) => !days.has(d)) } : f;
}

/** Merge `remoteRaw` (the account's copy, any shape) into `local`. The account wins identity ties. */
export function mergeSynced(local: SyncedDoc, remoteRaw: unknown): SyncedDoc {
  const remote = normalizeSynced(remoteRaw, local);
  // the account's goal target wins
  const week = mergeWeeks(remote, local);
  const freezes = withoutPracticedDays(mergeFreezes(local.freezes ?? noFreezeHistory(), remote.freezes ?? noFreezeHistory()), [
    local.streak.lastPracticeDay,
    remote.streak.lastPracticeDay,
    ...(week.weekStart ? week.weekDays.map((on, i) => (on ? addDays(week.weekStart!, i) : null)) : []),
  ]);
  return {
    // identity: the account's copy wins (it's what the learner set up)
    firstName: remote.firstName || local.firstName,
    role: remote.role || local.role,
    ...laterChoice(local, remote),
    progress: mergeAllProgress(local.progress, remote.progress),
    skills: mergeSkills(local.skills, remote.skills),
    streak: mergeStreaks(local.streak, remote.streak, freezes.usedDays),
    freezes,
    ...week,
    scenariosCompleted: Math.max(local.scenariosCompleted, remote.scenariosCompleted),
  };
}

/**
 * The server-side guest merge (merge-anonymous): the guest's stored document plays the
 * device ("local"), the account's plays the server ("remote"), exactly as when a guest
 * device signs in and merges. Returns the document to store.
 */
export function mergeGuestIntoAccount(accountRaw: unknown, guestRaw: unknown): Record<string, unknown> {
  const guest = normalizeSynced(guestRaw, freshSyncedDoc("mi-for-leaders", null));
  return toRemoteDoc(mergeSynced(guest, accountRaw));
}
