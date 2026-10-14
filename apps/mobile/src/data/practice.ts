import { getDrill, getLesson, getScenario, getSkill, type SkillId } from '@antelope/core';
import { useLearner } from '@/state/store';
import { openDrill, openLesson, openRoleplay, pickDrill, pickScenario, type PracticeSource } from './routes';

/**
 * Names and launchers for content referenced by id from the server (assignment
 * items, a trainer's recommended practice, submissions).
 */

export type RefKind = 'drill' | 'roleplay' | 'learn';

/** "The reports are late again" / "Evoking drill" / the lesson title. */
export function practiceTitle(kind: RefKind, ref: string | null | undefined): string {
  if (!ref) return kind === 'roleplay' ? 'A role-play' : kind === 'learn' ? 'A lesson' : 'A short practice';
  if (kind === 'roleplay') return getScenario(ref)?.title ?? ref;
  if (kind === 'learn') return getLesson(ref)?.title ?? ref;
  const d = getDrill(ref);
  return d ? `${getSkill(d.skill).name} drill` : ref;
}

export function practiceKindLabel(kind: RefKind): string {
  return kind === 'roleplay' ? 'Role-play' : kind === 'learn' ? 'Lesson' : 'Short practice';
}

/** "PM-017 role-play" — how a trainer's note refers to a session. */
export function sessionLabel(kind: 'roleplay' | 'drill', ref: string): string {
  return kind === 'roleplay' ? `${ref} role-play` : `${practiceTitle('drill', ref).replace(/ drill$/, '')} drill`;
}

export function openPractice(kind: RefKind, ref: string, source: PracticeSource) {
  if (kind === 'roleplay') openRoleplay(ref, { minutes: 12, source });
  else if (kind === 'learn') openLesson(ref, { source });
  else openDrill(ref, { minutes: 5, source });
}

/** "Any drill on Evoking": a drill at the learner's level for that skill. */
export function openAnyDrill(skill: SkillId | null, source: PracticeSource) {
  const s = skill ?? 'oars';
  openDrill(pickDrill(s, useLearner.getState().skills[s]?.level ?? 1), {
    minutes: 5,
    source,
  });
}

export function openAnyRoleplay(skill: SkillId | null, source: PracticeSource) {
  openRoleplay(pickScenario(skill ?? 'evoking').id, { minutes: 12, source });
}

export function practiceMinutes(kind: RefKind): string {
  return kind === 'roleplay' ? '10–15 min' : kind === 'learn' ? 'About 4 min' : 'About 5 min';
}

/** "Oct 10" */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
