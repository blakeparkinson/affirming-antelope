import { getSkill, type DemoTrainerAssignment } from '@antelope/core';
import type { Assignment, AssignmentItem, Cohort } from '@/state/account';
import { personSeed } from '@/state/account';
import type { PracticeRecord } from '@/state/store';
import { openAnyDrill, openAnyRoleplay, openPractice, practiceTitle } from './practice';
import { openDrill, openRoleplay } from './routes';

/**
 * What Home's assignment card draws, whichever source it came from: the demo
 * assignment (guests) or a real one from the learner's cohort.
 */
export interface AssignmentRowView {
  key: string;
  title: string;
  caption: string;
  done: boolean;
  /** 0..1, this item's share of the summary bar. */
  fill: number;
  open: () => void;
}

export interface AssignmentView {
  id: string;
  title: string;
  summary: string;
  note?: string;
  trainer: { name: string; role: string; seed: string };
  dueLabel: string;
  overdue: boolean;
  items: AssignmentRowView[];
}

const KIND = {
  drill: 'Short practice',
  roleplay: 'Role-play',
  learn: 'Lesson',
} as const;

export function demoAssignmentView(a: DemoTrainerAssignment): AssignmentView {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    note: a.note,
    trainer: {
      name: a.assignedBy.name,
      role: a.assignedBy.role,
      seed: 'rosa-lin-trainer',
    },
    dueLabel: a.dueLabel,
    overdue: false,
    items: a.items.map((it, i) => ({
      key: `${it.refId}-${i}`,
      title: it.title,
      caption: KIND[it.kind],
      done: it.done,
      fill: it.done ? 1 : 0,
      open: () => (it.kind === 'roleplay' ? openRoleplay(it.refId, { source: 'assignment' }) : openDrill(it.refId, { source: 'assignment' })),
    })),
  };
}

/** "Due today" / "Due tomorrow" / "Due Friday" / "Due Oct 24" / "Was due Oct 9". */
export function dueLabel(iso: string | null, now = new Date()): { label: string; overdue: boolean } {
  if (!iso) return { label: 'No due date', overdue: false };
  const due = new Date(iso);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(due) - day(now)) / 86_400_000);
  const md = due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  if (due.getTime() < now.getTime() && days < 0) return { label: `Was due ${md}`, overdue: true };
  if (days <= 0) return { label: 'Due today', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', overdue: false };
  if (days < 7)
    return {
      label: `Due ${due.toLocaleDateString(undefined, { weekday: 'long' })}`,
      overdue: false,
    };
  return { label: `Due ${md}`, overdue: false };
}

/** Same rule as the server's item_completion_count, for practice not uploaded yet. */
function matches(it: AssignmentItem, r: PracticeRecord): boolean {
  if (it.kind === 'any-drill') return r.kind === 'drill' && (!it.skill || r.skill === it.skill);
  if (it.kind === 'any-roleplay') return r.kind === 'roleplay' && (!it.skill || r.skill === it.skill);
  return r.kind === it.kind && !!it.refId && (it.refId === r.refId || it.refId === r.activityId);
}

function itemTitle(it: AssignmentItem): string {
  const skill = it.skill ? getSkill(it.skill).name : null;
  if (it.kind === 'any-drill') return skill ? `${skill} practice` : 'Any short practice';
  if (it.kind === 'any-roleplay') return skill ? `${skill} role-play` : 'Any role-play';
  return practiceTitle(it.kind, it.refId);
}

function itemKind(it: AssignmentItem): keyof typeof KIND {
  return it.kind === 'any-drill' ? 'drill' : it.kind === 'any-roleplay' ? 'roleplay' : it.kind;
}

function summary(items: AssignmentItem[]): string {
  const n = { drill: 0, roleplay: 0, learn: 0 };
  for (const it of items) n[itemKind(it)] += it.quantity;
  const parts: string[] = [];
  if (n.drill) parts.push(`${n.drill} short practice${n.drill > 1 ? 's' : ''}`);
  if (n.roleplay) parts.push(`${n.roleplay} role-play${n.roleplay > 1 ? 's' : ''}`);
  if (n.learn) parts.push(`${n.learn} lesson${n.learn > 1 ? 's' : ''}`);
  return parts.join(' + ');
}

/**
 * A cohort assignment, with progress from the server topped up by practice done on
 * this phone that hasn't synced yet (so a drill finished offline ticks at once).
 */
export function assignmentView(a: Assignment, cohort: Cohort | undefined, log: PracticeRecord[], ownerId: string | undefined): AssignmentView {
  const since = a.createdAt;
  const mine = log.filter((r) => r.at >= since && (!ownerId || r.ownerId === ownerId || !r.ownerId));
  const due = dueLabel(a.dueAt);
  return {
    id: a.id,
    title: a.title,
    summary: summary(a.items),
    note: a.instructions.trim() || undefined,
    trainer: {
      name: cohort?.trainerName ?? 'Your trainer',
      role: cohort?.name ?? '',
      seed: personSeed(cohort?.trainerName ?? 'Your trainer'),
    },
    dueLabel: due.label,
    overdue: due.overdue,
    items: a.items.map((it) => {
      const local = mine.filter((r) => matches(it, r)).length;
      const done = Math.min(it.quantity, Math.max(it.done, local));
      const kind = itemKind(it);
      const caption = it.quantity > 1 ? `${KIND[kind]} · ${done} of ${it.quantity} done` : KIND[kind];
      return {
        key: it.id,
        title: itemTitle(it),
        caption,
        done: done >= it.quantity,
        fill: done / it.quantity,
        open: () => {
          if (it.kind === 'any-drill') openAnyDrill(it.skill, 'assignment');
          else if (it.kind === 'any-roleplay') openAnyRoleplay(it.skill, 'assignment');
          else if (it.refId) openPractice(it.kind, it.refId, 'assignment');
        },
      };
    }),
  };
}
