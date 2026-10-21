import { getSkill, type DemoSkillProgress, type MiProcess, type Pathway, type SkillId } from '@antelope/core';

export interface ProgressRow {
  key: MiProcess;
  label: string;
  skill: SkillId;
  status: 'complete' | 'in-progress' | 'locked';
  /** The first week the active pathway gives this process, as its path shows (null if none). */
  opensWeek: number | null;
}

/** Each process and the skill whose level its row shows. */
const PROCESS_ROWS: { key: MiProcess; skill: SkillId; label?: string }[] = [
  { key: 'foundations', label: 'Foundations', skill: 'oars' },
  { key: 'engaging', skill: 'engaging' },
  { key: 'focusing', skill: 'focusing' },
  { key: 'evoking', skill: 'evoking' },
  { key: 'planning', skill: 'planning' },
];

/**
 * Home's "Your progress": the course's core processes, in the order the path reaches them.
 * A process's weeks are the path's units tagged with it (`PathUnit.process`), so "Opens in
 * week 5" is the week the path calls Evoking I, on the 8-week and the 12-week course alike.
 * Done once its last week is behind the learner; open from its first week, or earlier if
 * the skill was unlocked some other way (practiced from the Practice tab); locked before.
 */
export function progressRows(pathway: Pathway, week: number, skills: Partial<Record<SkillId, Pick<DemoSkillProgress, 'status'>>>): ProgressRow[] {
  return PROCESS_ROWS.map((r) => {
    const weeks = pathway.units.filter((u) => u.process === r.key).map((u) => u.week);
    const opensWeek = weeks.length ? Math.min(...weeks) : null;
    const lastWeek = weeks.length ? Math.max(...weeks) : Number.POSITIVE_INFINITY;
    const unlocked = !!skills[r.skill] && skills[r.skill]!.status !== 'locked';
    const status: ProgressRow['status'] =
      lastWeek < week ? 'complete' : (opensWeek !== null && opensWeek <= week) || unlocked ? 'in-progress' : 'locked';
    return { key: r.key, label: r.label ?? getSkill(r.skill).name, skill: r.skill, status, opensWeek };
  }).sort((a, b) => (a.opensWeek ?? Number.POSITIVE_INFINITY) - (b.opensWeek ?? Number.POSITIVE_INFINITY));
}
