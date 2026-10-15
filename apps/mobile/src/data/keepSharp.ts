import { DAILY_REP_MINUTES, dayKey, daysBetween, fadedSkills, type DemoSkillProgress, type FadedSkill, type SkillId, type SkillLevelNumber } from '@antelope/core';
import { track } from '@/lib/analytics';
import { today } from '@/state/store';
import { startDailyRep, type DailyRepView } from './dailyRep';
import { activeSetting, hasDrills, openDrill, pickDrill } from './routes';

/**
 * Home's "Keep it sharp" card (rules: `sharpness.ts` in core). Practised skills fade with
 * the days since their last practice; the least sharp faded one that has drills on the
 * active track gets the card. Practising it (here or anywhere) restores it.
 */
export interface KeepSharpView extends FadedSkill {
  level: SkillLevelNumber;
  /** How many skills are faded on this track, this one included. */
  count: number;
  /** Calendar days since the last practice, in the learner's time zone (for the card's copy). */
  calendarDays: number;
}

export function keepSharpFor(skills: Record<SkillId, DemoSkillProgress>, now: number, setting = activeSetting()): KeepSharpView | null {
  const faded = fadedSkills(skills, now).filter((f) => hasDrills(f.skill, setting));
  const first = faded[0];
  if (!first) return null;
  const calendarDays = daysBetween(dayKey(new Date(skills[first.skill].lastPracticedAt!)), dayKey(new Date(now)));
  return { ...first, level: skills[first.skill].level, count: faded.length, calendarDays };
}

const shown = new Set<string>();

/** Once per skill a day, however often Home is opened. */
export function skillFadedShown(f: KeepSharpView): void {
  const key = `${today()}|${f.skill}`;
  if (shown.has(key)) return;
  shown.add(key);
  track('skill_faded_shown', { skill: f.skill, level: f.level, sharpness: Math.round(f.sharpness * 100) / 100, days: f.days, faded: f.count });
}

/**
 * Refresh the skill with a short drill. When today's rep is already on this skill and not
 * done yet, that's the drill: starting it counts as the rep, rather than a second one beside it.
 */
export function startRefresh(f: KeepSharpView, rep: DailyRepView | null): void {
  if (rep && !rep.done && rep.skill === f.skill) {
    startDailyRep(rep, rep.drillId, 'home');
    return;
  }
  openDrill(pickDrill(f.skill, f.level), { minutes: DAILY_REP_MINUTES, source: 'refresh' });
}
