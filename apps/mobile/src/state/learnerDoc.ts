import { addDays, DEMO_LEARNER, freshSyncedDoc, weekdayOf, weekStartOf, LEGACY_CHOSEN_AT, progressFrom, type PathwayId, type PathwayProgress } from '@antelope/core';
import type { LearnerState } from './store';

/**
 * The learner progress document. The shape and every pure rule (upgrade, merge, the
 * server mirror) live in `@antelope/core` (`learnerDoc.ts`), so the API's guest merge
 * uses the same code as the app. This file adds the app-only seeds.
 */
export {
  emptyProgress,
  fillSkills,
  isUntouchedLegacyDemo,
  LEGACY_CHOSEN_AT,
  mergeProgress,
  skillRank,
  toRemoteDoc,
  upgradeDoc,
} from '@antelope/core';

/** A stable empty progress for selectors (never mutate). */
export const EMPTY_PROGRESS: PathwayProgress = Object.freeze({ currentWeek: 1, completedActivityIds: [], pathSeenWeek: 1 }) as PathwayProgress;

type Seeded = Omit<LearnerState, 'practiceLog' | 'sessions' | 'settings' | 'lastGreetedDay' | 'freezeNoticeSeen' | 'dailyRep'>;

/** A brand-new learner on a track. `chosenAt` is null until they pick one in the welcome. */
export function freshSeed(pathwayId: PathwayId, chosenAt: string | null): Seeded {
  const doc = freshSyncedDoc(pathwayId, chosenAt);
  return { ...doc, skills: structuredClone(doc.skills), assignment: null, demo: false };
}

/** Amanda, the demo learner (Me › Demo, dev builds only). */
export function demoSeed(today: string): Seeded {
  const d = DEMO_LEARNER;
  const weekdayToday = weekdayOf(today);
  // Demo week: practiced Monday through yesterday; today is still open.
  const weekDays = Array.from({ length: 7 }, (_, i) => i < weekdayToday && i < d.weeklyGoal.done + 2);
  return {
    firstName: d.user.firstName,
    role: d.user.role,
    activePathwayId: 'mi-for-leaders',
    pathwayChosenAt: LEGACY_CHOSEN_AT,
    progress: { 'mi-for-leaders': progressFrom(d) },
    skills: structuredClone(d.skills),
    streak: { days: d.streakDays, lastPracticeDay: addDays(today, -1) },
    // hit last week's goal: holding both freezes
    freezes: { earnedDays: [addDays(weekStartOf(today), -3)], usedDays: [] },
    weekStart: weekStartOf(today),
    weekDays,
    weeklyGoal: { ...d.weeklyGoal, hitCount: 3 },
    scenariosCompleted: 4,
    assignment: structuredClone(d.trainerAssignment),
    demo: true,
  };
}
