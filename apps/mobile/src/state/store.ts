import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type ActivityKind,
  dayKey,
  DEFAULT_PATHWAY_ID,
  type DemoSkillProgress,
  type DemoTrainerAssignment,
  type Debrief,
  type DrillFeedback,
  type PathwayId,
  type PathwayProgress,
  type ReminderPrefs,
  SYNCED_KEYS as CORE_SYNCED_KEYS,
  type SelfReflection,
  type SkillId,
  type SkillLevelNumber,
  type Turn,
  addDays,
  daysSincePracticed,
  FADED_BELOW,
  freezesAfterGoalHit,
  freezeReveal,
  freezesHeld,
  laterPracticedAt,
  liveStreakDays,
  markMilestone,
  milestoneToCelebrate,
  type MilestoneSeen,
  MAX_FREEZES,
  noFreezeHistory,
  skillSharpness,
  streakAfterPractice,
  type StreakFreezes,
  weekAfterPractice,
  weekAsOf,
  weekdayOf,
  weekStartOf,
} from '@antelope/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { findActivityIn, getPathway } from '@/data/pathways';
import { setPerson, track } from '@/lib/analytics';
import { isUuid, uuid } from '@/lib/uuid';
import { useMoments } from './moments';
import { demoSeed, EMPTY_PROGRESS, emptyProgress, freshSeed, upgradeDoc } from './learnerDoc';

export const LEARNER_KEY = 'antelope.learner.v1';

/**
 * Whether this device already had learner data before this launch (an existing
 * guest install, e.g. a tester's web link). Read before the store can write, so
 * the welcome screen only shows on a true first launch.
 */
export const hadLearnerData: Promise<boolean> = AsyncStorage.getItem(LEARNER_KEY)
  .then((v) => v != null)
  .catch(() => false);

/** Local calendar day, YYYY-MM-DD. */
export function today(d = new Date()): string {
  return dayKey(d);
}

/** Monday-start index 0..6 of a date. */
export function weekdayIndex(d = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export interface PracticeRecord {
  /** uuid, created on the device. Also the row's `client_id` in activity_completions. */
  id: string;
  kind: ActivityKind;
  skill?: SkillId;
  /** Drill id, ScenarioSpec id, or lesson id. */
  refId?: string;
  /** Path activity id when the practice came from the course. */
  activityId?: string;
  minutes: number;
  at: string; // ISO timestamp
  /** The account this was recorded under. Unset: made in guest mode, uploaded on first sign-in. */
  ownerId?: string;
}

/** A finished drill rep or role-play, as stored in practice_sessions. */
export interface PracticeSession {
  /** uuid, created on the device: both `client_id` and `id` of the practice_sessions row. */
  id: string;
  kind: 'roleplay' | 'drill';
  /** Drill id or ScenarioSpec id. */
  refId: string;
  skill?: SkillId;
  transcript: Turn[];
  /** Role-play: the AI debrief. Drill: the coach's feedback, or the multiple-choice picks. */
  debrief?: Debrief | DrillFeedback | { picks: string[]; hitTarget: boolean };
  selfReflection?: SelfReflection;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  /** Role-play: `voice` when the learner spoke at least one turn (Talk mode). Unset: typed. */
  mode?: 'text' | 'voice';
  ownerId?: string;
}

export interface Settings {
  /** 'system' follows the OS setting; 'reduce' forces cross-fades everywhere. */
  motion: 'system' | 'reduce';
  haptics: boolean;
  /** Role-play: how this learner last chose to reply on the brief. Unset: Talk when voice works here. */
  roleplayMode?: 'talk' | 'type';
  /** Role-play Talk mode: captions only, no spoken replies. */
  voiceMuted?: boolean;
  /** Practice reminders (device-local notifications). Unset until the learner turns them on. */
  reminders?: ReminderPrefs;
  /** How many reminder offers the learner has answered (see `shouldOfferReminders`). */
  reminderAsks?: number;
}

/** One pathway's place in its course (shared with the server merge in @antelope/core). */
export type { PathwayProgress };

export type PathwayChoiceSource = 'onboarding' | 'me' | 'cohort';

export interface LearnerState {
  /** Only the demo learner has a local name; real learners are greeted by their account name. */
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
  /** The run ending on `lastPracticeDay`, which may be over: show `liveStreak(s)`. */
  streak: { days: number; lastPracticeDay: string | null };
  /** Streak freezes earned and used. Show the count with `freezesHeld`. */
  freezes: StreakFreezes;
  /** Streak milestones celebrated, on any device (so none replays). */
  milestones: MilestoneSeen[];
  /** Monday of the week `weekDays` and `weeklyGoal.done` count. Show `thisWeek(s)`. */
  weekStart: string | null;
  /** Monday-start: which days of `weekStart`'s week had practice. */
  weekDays: boolean[];
  weeklyGoal: { target: number; done: number; hitCount: number };
  scenariosCompleted: number;
  /** The sample trainer assignment. Demo learner only; real learners get theirs from a cohort. */
  assignment: DemoTrainerAssignment | null;
  /** Me › Demo › "Demo learner" (dev builds): Amanda's seeded state, for demos. Never synced. */
  demo: boolean;
  practiceLog: PracticeRecord[];
  /** Finished drill reps and role-plays (newest first), kept so they can sync and be sent for review. */
  sessions: PracticeSession[];
  settings: Settings;
  /** Day the mascot last waved on Home; it greets once per day. */
  lastGreetedDay: string | null;
  /** The latest frozen day Home has told the learner about (device-only). */
  freezeNoticeSeen: string | null;
  /** Today's daily rep, pinned when first picked so it holds while skill progress moves (device-only). */
  dailyRep: DailyRepPin | null;
}

/** Frozen days to tell the learner about: the note, and the pips (Monday-start) that play the ice reveal. */
export interface FreezeNotice {
  days: string[];
  pips: boolean[];
  streakDays: number;
  held: number;
}

export interface DailyRepPin {
  day: string;
  pathwayId: PathwayId;
  drillId: string;
}

export interface LearnerActions {
  /** Mark a path activity done in whichever pathway owns it. Advances that pathway's week when its unit is done. */
  completeActivity: (activityId: string) => void;
  /** Log any finished practice (drill, role-play, lesson). Updates streak, weekly goal, and skill progress. */
  recordPractice: (p: Omit<PracticeRecord, 'id' | 'at' | 'ownerId'> & { at?: string }) => PracticeRecord;
  /** Keep a finished drill rep or role-play. Returns it with its client id. */
  recordSession: (p: Omit<PracticeSession, 'id' | 'ownerId'>) => PracticeSession;
  /** After a guest migration: guest-made records now belong to this account. */
  claimRecords: (userId: string, completionIds: string[], sessionIds: string[]) => void;
  /** After merge-anonymous: the guest's records now belong to the account they were merged into. */
  reownRecords: (fromUserId: string, toUserId: string) => void;
  /** Replace the synced part of the state (sign-in adoption, merges from the server). */
  applySynced: (synced: SyncedState) => void;
  /** Pick (or switch) the active track. Progress on the other track stays where it was. */
  choosePathway: (id: PathwayId, source: PathwayChoiceSource) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  markGreeted: () => void;
  pinDailyRep: (pin: DailyRepPin) => void;
  /**
   * Spend freezes on the days missed since the last practice (Home runs it on focus;
   * practising does it too). Returns the frozen days Home hasn't announced yet (and which
   * of this week's pips play the ice reveal), and marks them announced, so it shows once.
   */
  settleStreak: () => FreezeNotice | null;
  /** Path played the unlock for the current week. */
  markPathSeen: () => void;
  /** Dev: rewind `pathSeenWeek` one week so Path replays the latest unlock. */
  replayPathUnlock: () => void;
  /** Dev (Me › Demo): become Amanda, the seeded demo learner, or go back to a fresh start. */
  setDemo: (on: boolean) => void;
  /** Start over on the active track (keeps settings and the track choice). */
  resetProgress: () => void;
  /** Sign-out: back to a brand-new install's state (no track, no practice). Only device settings stay. */
  wipe: () => void;
  previewPathwayComplete: () => void;
  /** Dev (Me › Demo): yesterday missed, with a freeze to cover it, so Home plays the ice reveal. */
  previewFreezeReveal: () => void;
}

/**
 * The part of the store mirrored to `learner_state` so progress follows the account.
 * Practice history goes to its own tables; settings, greetings and the demo flag stay on the device.
 */
export const SYNCED_KEYS = CORE_SYNCED_KEYS satisfies readonly (keyof LearnerState)[];
export type SyncedState = Pick<LearnerState, (typeof SYNCED_KEYS)[number]>;

export function syncedState(s: LearnerState): SyncedState {
  const out = {} as Record<string, unknown>;
  for (const k of SYNCED_KEYS) out[k] = s[k];
  return out as SyncedState;
}

/** The active pathway's progress (a stable empty object before the first practice). */
export function progressOf(s: Pick<LearnerState, 'progress' | 'activePathwayId'>, id: PathwayId = s.activePathwayId): PathwayProgress {
  return s.progress[id] ?? EMPTY_PROGRESS;
}

/** The streak to show today: 0 once a day has been missed, before the next practice resets it. */
export function liveStreak(s: Pick<LearnerState, 'streak' | 'freezes'>, day = today()): number {
  return liveStreakDays(s.streak, day, s.freezes ?? noFreezeHistory());
}

/** Which days of this week a freeze covered (Monday-start). */
export function frozenThisWeek(s: Pick<LearnerState, 'freezes'>, day = today()): boolean[] {
  const used = new Set(s.freezes?.usedDays ?? []);
  const monday = weekStartOf(day);
  return Array.from({ length: 7 }, (_, i) => used.has(addDays(monday, i)));
}

/** This week's goal and practice days: an empty week once a new Monday-start week begins. */
export function thisWeek(s: Pick<LearnerState, 'weekStart' | 'weekDays' | 'weeklyGoal'>, day = today()) {
  return weekAsOf({ weekStart: s.weekStart, weekDays: s.weekDays, weeklyGoal: s.weeklyGoal }, day);
}

/** Who's signed in, if anyone. Set by the auth listener; new records are stamped with it. */
let currentOwner: string | undefined;
export function setRecordOwner(userId: string | undefined) {
  currentOwner = userId;
}

const LOCAL_DEFAULTS = (): Pick<LearnerState, 'practiceLog' | 'sessions' | 'settings' | 'lastGreetedDay' | 'freezeNoticeSeen' | 'dailyRep'> => ({
  practiceLog: [],
  sessions: [],
  settings: { motion: 'system', haptics: true },
  lastGreetedDay: null,
  freezeNoticeSeen: null,
  dailyRep: null,
});

/** A new install: a fresh learner who picks a track in the welcome (MI for Leaders, the default, until then or if they skip it). */
function seed(): LearnerState {
  return { ...freshSeed(DEFAULT_PATHWAY_ID, null), ...LOCAL_DEFAULTS() };
}

function bumpSkill(p: DemoSkillProgress | undefined, minutes: number, at: string): DemoSkillProgress {
  // practising a skill starts it, even before its week on the path
  const from: DemoSkillProgress = !p || p.status === 'locked' ? { level: 1, percent: 0, status: 'in-progress' } : p;
  let percent = from.percent + Math.max(6, Math.round(minutes * 2.5));
  let level = from.level;
  if (percent >= 100 && level < 6) {
    level = (level + 1) as SkillLevelNumber;
    percent -= 100;
  }
  // practising restores the skill's sharpness (spaced review); a backdated record never winds it back
  const lastPracticedAt = laterPracticedAt(p?.lastPracticedAt, at);
  return { level, percent: Math.min(percent, 100), status: 'in-progress', ...(lastPracticedAt ? { lastPracticedAt } : {}) };
}

/** Each skill's latest practice in the log, for skills that have no `lastPracticedAt` yet (store v7). */
function backfillPracticedAt(skills: LearnerState['skills'], log: readonly Pick<PracticeRecord, 'skill' | 'at'>[]): LearnerState['skills'] {
  const out = { ...skills };
  for (const r of log) {
    const p = r.skill && out[r.skill];
    if (!p || p.status === 'locked') continue;
    const lastPracticedAt = laterPracticedAt(p.lastPracticedAt, r.at);
    if (lastPracticedAt && lastPracticedAt !== p.lastPracticedAt) out[r.skill!] = { ...p, lastPracticedAt };
  }
  return out;
}

/** A skill the course has reached unlocks (level 1), so the ladder shows it as started. */
function unlockSkills(skills: LearnerState['skills'], ids: readonly SkillId[]): LearnerState['skills'] {
  let out = skills;
  for (const id of ids) {
    if (out[id]?.status === 'locked') out = { ...out, [id]: { ...out[id], status: 'in-progress' } };
  }
  return out;
}

export const useLearner = create<LearnerState & LearnerActions>()(
  persist(
    (set, get) => ({
      ...seed(),

      completeActivity: (activityId) =>
        set((s) => {
          const owner = findActivityIn(activityId);
          if (!owner) return s;
          const id = owner.pathway.id;
          const p = s.progress[id] ?? emptyProgress();
          if (p.completedActivityIds.includes(activityId)) return s;
          const completedActivityIds = [...p.completedActivityIds, activityId];
          const unit = owner.pathway.units.find((u) => u.week === p.currentWeek);
          const unitDone = !!unit && unit.activities.every((a) => completedActivityIds.includes(a.id));
          const currentWeek = unitDone ? p.currentWeek + 1 : p.currentWeek;
          const next = owner.pathway.units.find((u) => u.week === currentWeek);
          return {
            progress: { ...s.progress, [id]: { ...p, completedActivityIds, currentWeek } },
            skills: unitDone && next ? unlockSkills(s.skills, next.skills) : s.skills,
          };
        }),

      recordPractice: (input) => {
        const record: PracticeRecord = { ...input, id: uuid(), at: input.at ?? new Date().toISOString(), ownerId: currentOwner };
        const before = get();
        const day = today();
        const practised = streakAfterPractice(before.streak, day, before.freezes ?? noFreezeHistory());
        const goalHit = weekAfterPractice(before, day).justHit;
        const freezes = goalHit ? freezesAfterGoalHit(practised.freezes, day) : practised.freezes;
        const streakBefore = liveStreak(before, day);
        const milestone = milestoneToCelebrate(streakBefore, practised.streak, before.milestones ?? [], freezes.usedDays);
        const skillBefore = input.skill ? before.skills[input.skill] : undefined;
        const sharpBefore = skillSharpness(skillBefore, record.at);
        set((s) => {
          const { weekStart, weekDays, weeklyGoal } = weekAfterPractice(s, day);
          const assignment = s.assignment && {
            ...s.assignment,
            items: s.assignment.items.map((it) => (it.refId === input.refId ? { ...it, done: true } : it)),
          };
          return {
            practiceLog: [record, ...s.practiceLog].slice(0, 200),
            streak: practised.streak,
            freezes,
            milestones: milestone ? markMilestone(s.milestones ?? [], milestone, day) : s.milestones,
            weekStart,
            weekDays,
            weeklyGoal,
            scenariosCompleted: s.scenariosCompleted + (input.kind === 'roleplay' ? 1 : 0),
            skills: input.skill ? { ...s.skills, [input.skill]: bumpSkill(s.skills[input.skill], input.minutes, record.at) } : s.skills,
            assignment,
          };
        });
        if (input.activityId) get().completeActivity(input.activityId);
        // ids, enums and counts only
        track('practice_completed', {
          kind: input.kind === 'learn' ? 'lesson' : input.kind,
          ref_id: input.refId ?? '',
          ...(input.skill ? { skill: input.skill } : {}),
          minutes: input.minutes,
          ...(input.activityId ? { activity_id: input.activityId } : {}),
          in_course: !!input.activityId,
          pathway_id: before.activePathwayId,
        });
        const after = get();
        if (input.skill && skillBefore && sharpBefore !== null && sharpBefore < FADED_BELOW) {
          track('skill_refreshed', {
            skill: input.skill,
            level: skillBefore.level,
            sharpness: Math.round(sharpBefore * 100) / 100,
            days: daysSincePracticed(skillBefore, record.at) ?? 0,
            kind: input.kind === 'learn' ? 'lesson' : input.kind,
          });
        }
        if (practised.used.length) {
          track('streak_freeze_used', {
            freezes_used: practised.used.length,
            freezes_held: freezesHeld(practised.freezes),
            streak_days: before.streak.days,
            saved: practised.streak.days === before.streak.days + 1,
          });
        }
        if (freezes !== practised.freezes) {
          track('streak_freeze_earned', { freezes_held: freezesHeld(freezes), at_cap: freezesHeld(practised.freezes) >= MAX_FREEZES });
        }
        if (after.streak.days > streakBefore) track('streak_extended', { streak_days: after.streak.days });
        if (milestone) {
          track('streak_milestone_reached', { milestone, streak_days: after.streak.days });
          useMoments.getState().queue({ milestone, from: streakBefore });
        }
        const goalBefore = thisWeek(before, day).weeklyGoal;
        if (after.weeklyGoal.done === after.weeklyGoal.target && goalBefore.done !== goalBefore.target) {
          track('weekly_goal_hit', { target: after.weeklyGoal.target });
        }
        return record;
      },

      recordSession: (input) => {
        const session: PracticeSession = { ...input, id: uuid(), ownerId: currentOwner };
        set((s) => ({ sessions: [session, ...s.sessions].slice(0, 100) }));
        return session;
      },

      claimRecords: (userId, completionIds, sessionIds) =>
        set((s) => {
          const c = new Set(completionIds);
          const ss = new Set(sessionIds);
          return {
            practiceLog: s.practiceLog.map((r) => (c.has(r.id) && !r.ownerId ? { ...r, ownerId: userId } : r)),
            sessions: s.sessions.map((r) => (ss.has(r.id) && !r.ownerId ? { ...r, ownerId: userId } : r)),
          };
        }),

      reownRecords: (fromUserId, toUserId) =>
        set((s) => ({
          practiceLog: s.practiceLog.map((r) => (r.ownerId === fromUserId ? { ...r, ownerId: toUserId } : r)),
          sessions: s.sessions.map((r) => (r.ownerId === fromUserId ? { ...r, ownerId: toUserId } : r)),
        })),

      applySynced: (synced) => set(synced),

      choosePathway: (id, source) => {
        set((s) => {
          const pathway = getPathway(id);
          const progress = s.progress[id] ? s.progress : { ...s.progress, [id]: emptyProgress() };
          const week = progress[id]!.currentWeek;
          const unit = pathway.units.find((u) => u.week === week);
          return {
            activePathwayId: id,
            pathwayChosenAt: new Date().toISOString(),
            progress,
            skills: unit ? unlockSkills(s.skills, unit.skills) : s.skills,
          };
        });
        track('pathway_chosen', { pathway_id: id, source });
        setPerson({ pathway_id: id });
      },

      setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      markGreeted: () => set({ lastGreetedDay: today() }),
      pinDailyRep: (pin) => set({ dailyRep: pin }),
      settleStreak: () => {
        const s = get();
        const day = today();
        const { settled, seenThrough, reveal } = freezeReveal(s.streak, s.freezes ?? noFreezeHistory(), s.freezeNoticeSeen, day);
        if (settled.used.length) {
          set({ freezes: settled.freezes });
          track('streak_freeze_used', {
            freezes_used: settled.used.length,
            freezes_held: freezesHeld(settled.freezes),
            streak_days: s.streak.days,
            saved: settled.alive,
          });
        }
        // frozen days from the past week not yet announced here, including ones another device spent
        if (seenThrough !== s.freezeNoticeSeen) set({ freezeNoticeSeen: seenThrough });
        return reveal && { ...reveal, streakDays: s.streak.days };
      },
      markPathSeen: () =>
        set((s) => {
          const p = progressOf(s);
          if (p.pathSeenWeek === p.currentWeek) return s;
          return { progress: { ...s.progress, [s.activePathwayId]: { ...p, pathSeenWeek: p.currentWeek } } };
        }),
      replayPathUnlock: () =>
        set((s) => {
          const p = progressOf(s);
          if (p.currentWeek <= 1) return s;
          return { progress: { ...s.progress, [s.activePathwayId]: { ...p, pathSeenWeek: p.currentWeek - 1 } } };
        }),
      setDemo: (on) =>
        set((s) => {
          const keep = { settings: s.settings, lastGreetedDay: null, practiceLog: [], sessions: [], dailyRep: null };
          if (on) return { ...demoSeed(today()), ...keep };
          return { ...freshSeed(s.activePathwayId, s.pathwayChosenAt ?? new Date().toISOString()), ...keep };
        }),
      wipe: () => set((s) => ({ ...seed(), settings: s.settings })),
      resetProgress: () =>
        set((s) => ({
          ...(s.demo ? demoSeed(today()) : freshSeed(s.activePathwayId, s.pathwayChosenAt)),
          settings: s.settings,
          lastGreetedDay: null,
          dailyRep: null,
        })),
      previewFreezeReveal: () =>
        set((s) => {
          const day = today();
          const yesterday = addDays(day, -1);
          const week = thisWeek(s, day);
          const weekDays = [...week.weekDays];
          if (weekStartOf(yesterday) === week.weekStart) weekDays[weekdayOf(yesterday)] = false;
          return {
            streak: { days: Math.max(s.streak.days, 5), lastPracticeDay: addDays(day, -2) },
            // an old earn, so a freeze is held; forget any use from yesterday on
            freezes: { earnedDays: [...(s.freezes?.earnedDays ?? []), addDays(day, -30)], usedDays: (s.freezes?.usedDays ?? []).filter((d) => d < yesterday) },
            freezeNoticeSeen: null,
            weekStart: week.weekStart,
            weekDays,
          };
        }),
      previewPathwayComplete: () =>
        set((s) => {
          const pathway = getPathway(s.activePathwayId);
          const week = pathway.units.length + 1;
          return {
            progress: {
              ...s.progress,
              [s.activePathwayId]: {
                currentWeek: week,
                completedActivityIds: pathway.units.flatMap((u) => u.activities.map((a) => a.id)),
                pathSeenWeek: progressOf(s).pathSeenWeek,
              },
            },
          };
        }),
    }),
    {
      name: LEARNER_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 7,
      migrate: (persisted, from) => {
        const s = (persisted ?? {}) as Record<string, unknown> & Partial<LearnerState> & { reviews?: unknown };
        // v2 (accounts): every record gets a uuid client id; sessions replace the local-only review queue.
        if (from < 2) {
          s.practiceLog = (s.practiceLog ?? []).map((r) => (isUuid(r.id) ? r : { ...r, id: uuid() }));
          s.sessions = [];
          delete s.reviews;
        }
        // v3 (pathways): progress per pathway. An untouched demo seed (every install used to start
        // as Amanda) becomes a fresh learner who picks a track; real progress moves under its pathway.
        if (from < 3) {
          const up = upgradeDoc(s);
          const untouched = up.pathwayChosenAt === null;
          const fresh = freshSeed(DEFAULT_PATHWAY_ID, null);
          const next: LearnerState = {
            ...fresh,
            ...up,
            // the demo identity was never theirs: no "Amanda", no sample trainer assignment. Real
            // practice (streak, levels, the course) stays.
            firstName: '',
            role: '',
            skills: backfillPracticedAt({ ...fresh.skills, ...(up.skills ?? {}) }, s.practiceLog ?? []),
            assignment: null,
            demo: false,
            practiceLog: s.practiceLog ?? [],
            sessions: s.sessions ?? [],
            settings: s.settings ?? LOCAL_DEFAULTS().settings,
            lastGreetedDay: untouched ? null : (s.lastGreetedDay ?? null),
            freezeNoticeSeen: null,
            dailyRep: null,
          };
          return next as LearnerState & LearnerActions;
        }
        // v4 (calendar weeks): the week weekDays and done count is the week of the last practice
        if (from < 4) {
          const last = s.streak?.lastPracticeDay;
          s.weekStart = last ? weekStartOf(last) : null;
        }
        // v5 (streak freezes): no ledger yet, so the learner holds the starting freeze
        if (from < 5) {
          s.freezes ??= noFreezeHistory();
          s.freezeNoticeSeen ??= null;
        }
        // v6 (streak milestones): none celebrated yet. Only a practice that crosses one plays it,
        // so a learner already past 14 sees nothing until they reach 30.
        if (from < 6) s.milestones ??= [];
        // v7 (spaced review): each skill's last practice, from the log this device kept. Skills with
        // no record here stay unset (never faded) until they're practised or another device's time syncs.
        if (from < 7 && s.skills) s.skills = backfillPracticedAt(s.skills, s.practiceLog ?? []);
        return s as unknown as LearnerState & LearnerActions;
      },
    },
  ),
);

/** Week status for the path. */
export type WeekStatus = 'complete' | 'current' | 'locked';
export function weekStatus(week: number, currentWeek: number): WeekStatus {
  if (week < currentWeek) return 'complete';
  if (week === currentWeek) return 'current';
  return 'locked';
}

/** The active track right now (for analytics and launchers outside React). */
export function activePathwayId(): PathwayId {
  return useLearner.getState().activePathwayId;
}
