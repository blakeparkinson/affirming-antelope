import { useMemo } from 'react';
import { type PathActivity, type Pathway, type PathUnit, type Setting, type SkillId } from '@antelope/core';
import { getPathway } from '@/data/pathways';
import { freezesHeld } from '@antelope/core';
import { frozenThisWeek, liveStreak, progressOf, thisWeek, useLearner, type PathwayProgress } from './store';
import { progressRows, type ProgressRow } from './progressRows';
import { useToday } from './useToday';

/** The streak to show: 0 once a day has been missed (the stored run stays until the next practice). */
export function useStreakDays(): number {
  const day = useToday();
  return useLearner((s) => liveStreak(s, day));
}

/** This week's goal and practice days, empty once a new week has begun. Stable until the store or the week changes. */
export function useThisWeek(): { weekDays: boolean[]; weeklyGoal: { target: number; done: number; hitCount: number } } {
  const weekStart = useLearner((s) => s.weekStart);
  const weekDays = useLearner((s) => s.weekDays);
  const weeklyGoal = useLearner((s) => s.weeklyGoal);
  const day = useToday();
  return useMemo(() => thisWeek({ weekStart, weekDays, weeklyGoal }, day), [weekStart, weekDays, weeklyGoal, day]);
}

/** Which days of this week a streak freeze covered (Monday-start). Stable until the ledger or the day changes. */
export function useFrozenThisWeek(): boolean[] {
  const freezes = useLearner((s) => s.freezes);
  const day = useToday();
  return useMemo(() => frozenThisWeek({ freezes }, day), [freezes, day]);
}

/** Streak freezes held (0..2). */
export function useFreezesHeld(): number {
  return useLearner((s) => (s.freezes ? freezesHeld(s.freezes) : 1));
}

/** The learner's active track (MI for Leaders or MI for Clinicians). */
export function useActivePathway(): Pathway {
  const id = useLearner((s) => s.activePathwayId);
  return getPathway(id);
}

/** Where conversations on the active track happen: 'workplace' or 'clinical'. */
export function useSetting(): Setting {
  return useActivePathway().setting;
}

/** The active pathway's progress (week, completed activities, last unlock seen). */
export function useProgress(): PathwayProgress {
  return useLearner(progressOf);
}

export function useCurrentWeek(): number {
  return useLearner((s) => progressOf(s).currentWeek);
}

export function useCompletedActivityIds(): string[] {
  return useLearner((s) => progressOf(s).completedActivityIds);
}

export function totalWeeks(p: Pathway): number {
  return p.units.length;
}

export function useCurrentUnit(): PathUnit | undefined {
  const pathway = useActivePathway();
  const week = useCurrentWeek();
  return pathway.units.find((u) => u.week === week);
}

/** "Week 3 of 8" / "Complete". */
export function weekLabel(p: Pathway, week: number): string {
  return week > p.units.length ? 'Complete' : `Week ${week} of ${p.units.length}`;
}

/** First activity in a unit the learner hasn't finished. */
export function nextActivity(unit: PathUnit, completed: string[]): PathActivity | undefined {
  return unit.activities.find((a) => !completed.includes(a.id));
}

/** Skills the active pathway teaches, in the order its units reach them. */
export function pathwaySkills(p: Pathway): SkillId[] {
  const out: SkillId[] = [];
  for (const u of p.units) for (const s of u.skills) if (!out.includes(s)) out.push(s);
  return out;
}

export type { ProgressRow } from './progressRows';

/** Home's "Your progress" for the active pathway and week (progressRows.ts). */
export function useProgressRows(): ProgressRow[] {
  const skills = useLearner((s) => s.skills);
  const week = useCurrentWeek();
  const pathway = useActivePathway();
  return progressRows(pathway, week, skills);
}
