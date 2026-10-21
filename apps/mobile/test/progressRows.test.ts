/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPathway, type Pathway, type SkillId } from '@antelope/core';
import { progressRows, type ProgressRow } from '../src/state/progressRows';

type Skills = Partial<Record<SkillId, { status: 'locked' | 'in-progress' }>>;

/** A new learner: only week 1's skills are open (store seed and `choosePathway`). */
const fresh = (p: Pathway): Skills => {
  const out: Skills = {};
  for (const u of p.units) for (const s of u.skills) out[s] = { status: p.units[0].skills.includes(s) ? 'in-progress' : 'locked' };
  return out;
};
const row = (rows: ProgressRow[], key: ProgressRow['key']) => rows.find((r) => r.key === key)!;
/** The title the Path screen shows for a week. */
const title = (p: Pathway, week: number | null) => p.units.find((u) => u.week === week)?.title;

for (const id of ['mi-for-leaders', 'mi-for-clinicians'] as const) {
  const p = getPathway(id);

  describe(`Home progress weeks match the path (${id}, ${p.units.length} weeks)`, () => {
    const rows = progressRows(p, 1, fresh(p));

    it('opens each process in the week the path names it', () => {
      assert.equal(title(p, row(rows, 'foundations').opensWeek), 'Overview');
      assert.equal(title(p, row(rows, 'engaging').opensWeek), 'Engaging and OARS');
      assert.equal(title(p, row(rows, 'focusing').opensWeek), 'Focusing');
      assert.equal(title(p, row(rows, 'evoking').opensWeek), 'Evoking I');
      assert.equal(title(p, row(rows, 'planning').opensWeek), 'Planning');
    });

    it('lists the processes in the order the path reaches them', () => {
      assert.deepEqual(
        rows.map((r) => [r.key, r.opensWeek]),
        [['foundations', 1], ['engaging', 3], ['focusing', 4], ['evoking', 5], ['planning', 7]],
      );
    });

    it('in week 1, Foundations is open, Engaging too (week 1 teaches its skill), and the rest wait', () => {
      assert.equal(row(rows, 'foundations').status, 'in-progress');
      assert.equal(row(rows, 'engaging').status, 'in-progress');
      assert.equal(row(rows, 'focusing').status, 'locked');
      assert.equal(row(rows, 'evoking').status, 'locked');
    });

    it('opens Evoking in week 5 even though the evoking skill itself unlocks in week 6', () => {
      assert.equal(row(progressRows(p, 4, fresh(p)), 'evoking').status, 'locked');
      assert.equal(row(progressRows(p, 5, fresh(p)), 'evoking').status, 'in-progress');
      assert.equal(row(progressRows(p, 6, fresh(p)), 'evoking').status, 'in-progress');
      assert.equal(row(progressRows(p, 7, fresh(p)), 'evoking').status, 'complete');
    });

    it('completes Foundations after week 1, and Engaging only after week 3', () => {
      const w2 = progressRows(p, 2, fresh(p));
      assert.equal(row(w2, 'foundations').status, 'complete');
      assert.equal(row(w2, 'engaging').status, 'in-progress');
      assert.equal(row(progressRows(p, 4, fresh(p)), 'engaging').status, 'complete');
    });

    it('keeps a skill opened early by practice open before its week', () => {
      const practiced = { ...fresh(p), planning: { status: 'in-progress' as const } };
      assert.equal(row(progressRows(p, 2, practiced), 'planning').status, 'in-progress');
      assert.equal(row(progressRows(p, 2, practiced), 'planning').opensWeek, 7);
    });
  });
}

describe('a pathway without a process', () => {
  it('sorts it last, never opens it by week, and leaves "Not on this track" to the row', () => {
    const p = getPathway('mi-for-leaders');
    const noPlanning: Pathway = { ...p, units: p.units.map((u) => (u.process === 'planning' ? { ...u, process: undefined } : u)) };
    const rows = progressRows(noPlanning, 12, {});
    assert.equal(rows[rows.length - 1].key, 'planning');
    assert.equal(row(rows, 'planning').opensWeek, null);
    assert.equal(row(rows, 'planning').status, 'locked');
  });
});
