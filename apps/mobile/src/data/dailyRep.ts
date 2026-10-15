import { DAILY_REP_MINUTES, DAILY_REP_RECENT_DAYS, addDays, dayKey, getDrill, getSkill, pickDailyRep, type DailyRep, type DailyRepEntry, type PathwayId, type SkillId } from '@antelope/core';
import { useEffect, useMemo } from 'react';
import { track } from '@/lib/analytics';
import { today, useLearner, type LearnerState } from '@/state/store';
import { getPathway } from './pathways';
import { openDrill } from './routes';

/**
 * Home's daily rep (rules: `pickDailyRep` in core). The first pick of the day is pinned in
 * the store, so it holds while practice moves skill progress, and a tapped reminder opens
 * the same drill Home shows. Done once that drill has been practiced today; then "one
 * more" is the next pick, never a drill already done today.
 */
export interface DailyRepView {
  drillId: string;
  skill: SkillId;
  /** Course activity title when the path uses the drill ("Spot the open question"), else "Reflections drill". */
  title: string;
  minutes: number;
  done: boolean;
  /** After the rep: the next drill to offer. */
  oneMore: { drillId: string; skill: SkillId; title: string } | null;
}

type RepInputs = Pick<LearnerState, 'skills' | 'practiceLog' | 'sessions' | 'activePathwayId' | 'dailyRep'>;

/** Drill ids practiced today, and on the few days before, newest first. */
function history(s: RepInputs, day: string) {
  const since = addDays(day, -DAILY_REP_RECENT_DAYS);
  const reps = [
    ...s.practiceLog.filter((r) => r.kind === 'drill' && r.refId).map((r) => ({ id: r.refId!, at: r.at })),
    ...s.sessions.filter((x) => x.kind === 'drill').map((x) => ({ id: x.refId, at: x.endedAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const completedToday: string[] = [];
  const recentDrillIds: string[] = [];
  for (const r of reps) {
    const d = dayKey(new Date(r.at));
    if (d >= day) completedToday.push(r.id);
    else if (d >= since) recentDrillIds.push(r.id);
  }
  return { completedToday, recentDrillIds };
}

function titleOf(drillId: string, pathwayId: PathwayId): string {
  for (const u of getPathway(pathwayId).units) {
    const a = u.activities.find((x) => x.kind === 'drill' && x.refIds?.includes(drillId));
    if (a) return a.title;
  }
  const d = getDrill(drillId);
  return `${getSkill(d?.skill ?? 'oars').name} drill`;
}

/** Today's rep, and the pin to store when it isn't pinned yet. */
export function dailyRepFor(s: RepInputs, day: string = today()): { view: DailyRepView; pin: RepInputs['dailyRep'] } | null {
  const pathway = s.activePathwayId;
  const { completedToday, recentDrillIds } = history(s, day);
  const pinned = s.dailyRep;
  const kept = pinned && pinned.day === day && pinned.pathwayId === pathway && getDrill(pinned.drillId) ? pinned.drillId : null;
  const base = { skills: s.skills, recentDrillIds, pathway, day };
  const rep: DailyRep | null = kept ? null : pickDailyRep({ ...base, completedToday: [] });
  const drillId = kept ?? rep?.drillId;
  if (!drillId) return null;
  const drill = getDrill(drillId)!;
  const done = completedToday.includes(drillId);
  const next = done ? pickDailyRep({ ...base, completedToday: [drillId, ...completedToday] }) : null;
  const oneMore = next && next.drillId !== drillId ? { drillId: next.drillId, skill: next.skill, title: titleOf(next.drillId, pathway) } : null;
  return {
    view: { drillId, skill: drill.skill, title: titleOf(drillId, pathway), minutes: DAILY_REP_MINUTES, done, oneMore },
    pin: kept ? null : { day, pathwayId: pathway, drillId },
  };
}

/** Today's rep from outside React (a tapped reminder). Pins it if Home hasn't yet. */
export function currentDailyRep(): DailyRepView | null {
  const s = useLearner.getState();
  const r = dailyRepFor(s);
  if (r?.pin) s.pinDailyRep(r.pin);
  return r?.view ?? null;
}

export function useDailyRep(): DailyRepView | null {
  const skills = useLearner((s) => s.skills);
  const practiceLog = useLearner((s) => s.practiceLog);
  const sessions = useLearner((s) => s.sessions);
  const activePathwayId = useLearner((s) => s.activePathwayId);
  const dailyRep = useLearner((s) => s.dailyRep);
  const pinDailyRep = useLearner((s) => s.pinDailyRep);
  const day = today();
  const r = useMemo(
    () => dailyRepFor({ skills, practiceLog, sessions, activePathwayId, dailyRep }, day),
    [skills, practiceLog, sessions, activePathwayId, dailyRep, day],
  );
  useEffect(() => {
    if (r?.pin) pinDailyRep(r.pin);
  }, [r?.pin, pinDailyRep]);
  return r?.view ?? null;
}

const shown = new Set<string>();

/** Home shows the card: once per drill and state a day, however often Home is opened. */
export function dailyRepShown(rep: DailyRepView): void {
  const key = `${today()}|${rep.drillId}|${rep.done}`;
  if (shown.has(key)) return;
  shown.add(key);
  track('daily_rep_shown', { drill_id: rep.drillId, skill: rep.skill, done: rep.done, pathway_id: useLearner.getState().activePathwayId });
}

/** Open the rep (or, after it, one more) as a Today drill. */
export function startDailyRep(rep: DailyRepView, drillId: string, entry: DailyRepEntry): void {
  const skill = getDrill(drillId)?.skill ?? rep.skill;
  track('daily_rep_started', { drill_id: drillId, skill, entry, one_more: drillId !== rep.drillId, pathway_id: useLearner.getState().activePathwayId });
  openDrill(drillId, { minutes: rep.minutes, source: 'today' });
}
