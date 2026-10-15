import { useMemo } from 'react';
import { getSkill, type PathActivity, type Pathway, type PathUnit, type Setting, type SkillId } from '@antelope/core';
import { getPathway } from '@/data/pathways';
import { freezesHeld } from '@antelope/core';
import { frozenThisWeek, liveStreak, progressOf, thisWeek, today, useLearner, type PathwayProgress } from './store';

/** The streak to show: 0 once a day has been missed (the stored run stays until the next practice). */
export function useStreakDays(): number {
  return useLearner((s) => liveStreak(s));
}

/** This week's goal and practice days, empty once a new week has begun. Stable until the store or the week changes. */
export function useThisWeek(): { weekDays: boolean[]; weeklyGoal: { target: number; done: number; hitCount: number } } {
  const weekStart = useLearner((s) => s.weekStart);
  const weekDays = useLearner((s) => s.weekDays);
  const weeklyGoal = useLearner((s) => s.weeklyGoal);
  const day = today();
  return useMemo(() => thisWeek({ weekStart, weekDays, weeklyGoal }, day), [weekStart, weekDays, weeklyGoal, day]);
}

/** Which days of this week a streak freeze covered (Monday-start). Stable until the ledger or the day changes. */
export function useFrozenThisWeek(): boolean[] {
  const freezes = useLearner((s) => s.freezes);
  const day = today();
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

export interface ProgressRow {
  key: string;
  label: string;
  skill: SkillId;
  status: 'complete' | 'in-progress' | 'locked';
  /** The first week of the active pathway that teaches the skill (null if none does). */
  opensWeek: number | null;
}

const PROCESS_ROWS: { key: string; skill: SkillId; label?: string }[] = [
  { key: 'foundations', label: 'Foundations', skill: 'oars' },
  { key: 'engaging', skill: 'engaging' },
  { key: 'focusing', skill: 'focusing' },
  { key: 'evoking', skill: 'evoking' },
  { key: 'planning', skill: 'planning' },
];

/** The last week whose lead skill is this one (Evoking I and II → the week of II). */
function processWeek(p: Pathway, skill: SkillId): number {
  const lead = p.units.filter((u) => u.skills[0] === skill).map((u) => u.week);
  const any = p.units.filter((u) => u.skills.includes(skill)).map((u) => u.week);
  const weeks = lead.length ? lead : any;
  return weeks.length ? Math.max(...weeks) : Number.POSITIVE_INFINITY;
}

/**
 * Home's "Your progress": the course's core processes. A process is done once the
 * last unit that teaches it is behind the learner; otherwise it shows the skill's
 * level (no percentages). Unit weeks come from the active pathway, so the 8-week
 * clinician course and the 12-week leaders course both line up.
 */
export function useProgressRows(): ProgressRow[] {
  const skills = useLearner((s) => s.skills);
  const week = useCurrentWeek();
  const pathway = useActivePathway();
  return PROCESS_ROWS.map((r) => {
    const unitWeek = r.key === 'foundations' ? 1 : processWeek(pathway, r.skill);
    const p = skills[r.skill];
    const status = unitWeek < week ? 'complete' : !p || p.status === 'locked' ? 'locked' : 'in-progress';
    const first = pathway.units.find((u) => u.skills.includes(r.skill));
    return { key: r.key, label: r.label ?? getSkill(r.skill).name, skill: r.skill, status, opensWeek: first?.week ?? null };
  });
}
