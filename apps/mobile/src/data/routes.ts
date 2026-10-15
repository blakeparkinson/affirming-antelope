import { DRILLS, SCENARIOS, getDrill, type PathActivity, type ScenarioSpec, type Setting, type SkillId, type SkillLevelNumber } from '@antelope/core';
import { router } from 'expo-router';
import { markReplace } from '@/motion/launch';
import { useLearner } from '@/state/store';
import { dailyDrillOrder, drillsForSetting, findActivityIn, getPathway, pathwayForSetting, scenariosForSetting } from './pathways';

/**
 * Route contract for the practice loop. Screens that launch practice call
 * these; the drill / role-play / lesson screens read the same params.
 *
 *   /drill/[id]                 id = Drill id.        ?activityId &minutes &source
 *   /roleplay/[scenarioId]      scenarioId = ScenarioSpec id. ?activityId &minutes &source
 *   /lesson/[id]                id = Lesson id.       ?activityId
 *
 * `source` is where the learner came from: 'today' | 'path' | 'assignment' | 'practice' | 'challenge' | 'review' | 'next_step' | 'refresh'.
 * `activityId` is set only for course activities; pass it to recordPractice so the path advances.
 */
export type PracticeSource = 'today' | 'path' | 'assignment' | 'practice' | 'challenge' | 'review' | 'next_step' | 'refresh';

/**
 * `replace: true` swaps the current practice screen instead of stacking a new
 * one (debrief "Try a harder scenario", lesson "Start next"), so Close still
 * returns to where the learner started.
 */
type Nav = { replace?: boolean };

// Rapid taps never stack two practice screens: one launch per transition window.
let lockedUntil = 0;
const go = (nav: Nav | undefined, href: Parameters<typeof router.push>[0]) => {
  const now = Date.now();
  if (now < lockedUntil) return;
  lockedUntil = now + 650;
  if (nav?.replace) {
    markReplace();
    router.replace(href);
  } else router.push(href);
};

export function openDrill(id: string, opts: { activityId?: string; minutes?: number; source: PracticeSource } & Nav) {
  go(opts, {
    pathname: '/drill/[id]',
    params: { id, source: opts.source, ...(opts.activityId ? { activityId: opts.activityId } : {}), ...(opts.minutes ? { minutes: String(opts.minutes) } : {}) },
  });
}

export function openRoleplay(scenarioId: string, opts: { activityId?: string; minutes?: number; source: PracticeSource } & Nav) {
  go(opts, {
    pathname: '/roleplay/[scenarioId]',
    params: {
      scenarioId,
      source: opts.source,
      ...(opts.activityId ? { activityId: opts.activityId } : {}),
      ...(opts.minutes ? { minutes: String(opts.minutes) } : {}),
    },
  });
}

export function openLesson(id: string, opts: { activityId?: string; minutes?: number; source?: PracticeSource } & Nav) {
  go(opts, {
    pathname: '/lesson/[id]',
    params: { id, ...(opts.source ? { source: opts.source } : {}), ...(opts.activityId ? { activityId: opts.activityId } : {}), ...(opts.minutes ? { minutes: String(opts.minutes) } : {}) },
  });
}

export function openActivity(a: PathActivity, source: PracticeSource = 'path', nav?: Nav) {
  const ref = a.refIds?.[0] ?? a.id;
  if (a.kind === 'drill') openDrill(ref, { activityId: a.id, minutes: a.minutes, source, ...nav });
  else if (a.kind === 'roleplay') openRoleplay(ref, { activityId: a.id, minutes: a.minutes, source, ...nav });
  else openLesson(ref, { activityId: a.id, minutes: a.minutes, source, ...nav });
}

/** The path activity a practice screen was opened for, if any (any pathway). */
export function findActivity(activityId?: string): PathActivity | undefined {
  return findActivityIn(activityId)?.activity;
}

/** The setting of the learner's active track. */
export function activeSetting(): Setting {
  return getPathway(useLearner.getState().activePathwayId).setting;
}

/**
 * Next drill for "One more?": the rest of the course activity's drills first,
 * then onward through the daily order of the drill's own setting (a clinical
 * rep is followed by another clinical rep), skipping anything done this session.
 */
export function nextDrillId(current: string, done: string[], activityId?: string): string {
  const seen = new Set([...done, current]);
  const fromActivity = findActivity(activityId)?.refIds?.find((id) => !seen.has(id) && DRILLS.some((d) => d.id === id));
  if (fromActivity) return fromActivity;
  const setting = getDrill(current)?.setting ?? activeSetting();
  const order = dailyDrillOrder(pathwayForSetting(setting));
  const i = order.indexOf(current);
  for (let k = 1; k <= order.length; k++) {
    const id = order[(i + k + order.length) % order.length];
    if (!seen.has(id)) return id;
  }
  return order[0];
}

/**
 * Best drill for a skill at (or just below) the learner's level, in a setting
 * (the active track's by default). A skill with no drills in that setting yet
 * borrows from the other setting before giving up on the skill.
 */
export function pickDrill(skill: SkillId, level: SkillLevelNumber, setting: Setting = activeSetting()): string {
  const inSetting = drillsForSetting(setting);
  const forSkill = inSetting.filter((d) => d.skill === skill);
  const anywhere = DRILLS.filter((d) => d.skill === skill);
  const pool = forSkill.length ? forSkill : anywhere.length ? anywhere : inSetting.length ? inSetting : DRILLS;
  const atLevel = pool.filter((d) => d.level === level);
  const below = pool.filter((d) => d.level <= level).sort((a, b) => b.level - a.level);
  const list = atLevel.length ? atLevel : below.length ? below : pool;
  return list[Math.floor(Math.random() * list.length)].id;
}

/** Whether a setting has its own drills for a skill. */
export function hasDrills(skill: SkillId, setting: Setting): boolean {
  return drillsForSetting(setting).some((d) => d.skill === skill);
}

/** A scenario in the setting that exercises the skill, falling back to any scenario in the setting. */
export function pickScenario(skill: SkillId, setting: Setting = activeSetting()): ScenarioSpec {
  const inSetting = scenariosForSetting(setting);
  const base = inSetting.length ? inSetting : SCENARIOS;
  const fits = base.filter((s) => s.primaryChallenge === skill || s.targetSkills.includes(skill));
  const pool = fits.length ? fits : base;
  return pool[Math.floor(Math.random() * pool.length)];
}
