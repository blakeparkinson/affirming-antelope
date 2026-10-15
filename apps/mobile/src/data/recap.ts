import {
  buildWeeklyRecap,
  dayKey,
  getScenario,
  recapWeekFor,
  shouldShowRecap,
  weekStartOf,
  type Debrief,
  type RecapRoleplay,
  type WeeklyRecap,
} from '@antelope/core';
import { currentDailyRep, startDailyRep } from '@/data/dailyRep';
import { openDrill, pickDrill } from '@/data/routes';
import { track } from '@/lib/analytics';
import { useMoments, type RecapMoment } from '@/state/moments';
import { useLearner, type LearnerState, type PracticeSession } from '@/state/store';

/**
 * The weekly recap's data and its moments. Everything comes from what this device holds:
 * the practice log, the role-plays kept on it, the skill levels. No API call.
 */

const isDebrief = (d: PracticeSession['debrief']): d is Debrief => !!d && 'annotations' in d;

function roleplaysOf(sessions: readonly PracticeSession[]): RecapRoleplay[] {
  return sessions
    .filter((x) => x.kind === 'roleplay')
    .map((x) => ({
      id: x.id,
      refId: x.refId,
      transcript: x.transcript,
      annotations: isDebrief(x.debrief) ? x.debrief.annotations : undefined,
      start: getScenario(x.refId)?.desiredTrajectory[0],
      endedAt: x.endedAt,
    }));
}

export function recapFor(
  s: Pick<LearnerState, 'practiceLog' | 'sessions' | 'skills' | 'weekStart' | 'weekDays' | 'weeklyGoal' | 'streak' | 'freezes'>,
  weekStart: string,
): WeeklyRecap {
  return buildWeeklyRecap(s.practiceLog, s.skills, weekStart, {
    roleplays: roleplaysOf(s.sessions),
    // practice on another device: its days and count arrive with the synced week
    week: { weekStart: s.weekStart, weekDays: s.weekDays, weeklyGoal: s.weeklyGoal },
    // and once this week's practice has moved the synced week on, the streak's run still has them
    streak: s.streak,
    frozenDays: s.freezes?.usedDays ?? [],
  });
}

/**
 * Home's first look of a new week: show last week's recap once, on whichever device opens
 * first. It's marked seen the moment it shows (the mark syncs), so a dismissal, a crash or
 * a second device never brings it back.
 */
export function maybeShowRecap(day: string = dayKey()): void {
  const s = useLearner.getState();
  const m = useMoments.getState();
  if (m.recap) return;
  const practiceDays = [s.streak.lastPracticeDay, ...s.practiceLog.map((r) => dayKey(new Date(r.at)))];
  if (!shouldShowRecap({ seenWeek: s.recapSeenWeek, today: day, practiceDays })) return;
  s.markRecapSeen(weekStartOf(day));
  m.showRecap({ weekStart: recapWeekFor(day) });
}

/** Me › Demo: this week so far, as the recap would show it (no seen mark, no analytics). */
export function previewRecap(): void {
  useMoments.getState().showRecap({ weekStart: weekStartOf(dayKey()), preview: true });
}

export function recapShown(moment: RecapMoment, r: WeeklyRecap): void {
  if (moment.preview) return;
  track('weekly_recap_shown', {
    week_start: r.weekStart,
    empty: r.empty,
    days_practiced: r.daysPracticed,
    reps: r.reps,
    has_roleplay: !!r.bestRoleplay,
    has_line: !!r.bestRoleplay?.line,
  });
}

/** "Start this week": today's rep (or the one after it), else a drill on the skill to work on. */
export function startThisWeek(moment: RecapMoment, r: WeeklyRecap): void {
  if (!moment.preview) track('weekly_recap_cta', { week_start: r.weekStart, action: 'start', empty: r.empty });
  const rep = currentDailyRep();
  if (rep && !rep.done) return startDailyRep(rep, rep.drillId, 'recap');
  if (rep?.oneMore) return startDailyRep(rep, rep.oneMore.drillId, 'recap');
  const skill = r.nextSkill?.skill ?? 'oars';
  openDrill(pickDrill(skill, r.nextSkill?.level ?? 1), { minutes: 2, source: 'today' });
}

export function recapDismissed(moment: RecapMoment, r: WeeklyRecap): void {
  if (!moment.preview) track('weekly_recap_cta', { week_start: r.weekStart, action: 'dismiss', empty: r.empty });
}
