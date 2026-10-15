// DRAFT — pending trainer review
// Mock learner state for the demo user, plus a fresh state for real new
// learners. All people are fictional.

import { dailyDrillOrder, getDrill } from "./drills";
import { DEFAULT_PATHWAY_ID, getPathway } from "./pathway";
import { SKILLS } from "./skills";
import type { ActivityKind, PathwayId, SkillId, SkillLevelNumber } from "./types";

export type UnitStatus = "complete" | "in-progress" | "locked";

export interface DemoSkillProgress {
  level: SkillLevelNumber;
  /** Percent of the way through the current level, 0-100. */
  percent: number;
  status: UnitStatus;
  /**
   * When the skill was last practised (ISO), for spaced review (`sharpness.ts`). Unset until
   * the first practice after it was added. Merges keep the later of two devices' values.
   */
  lastPracticedAt?: string;
}

export interface DemoAssignmentItem {
  kind: ActivityKind;
  title: string;
  refId: string;
  done: boolean;
}

export interface DemoTrainerAssignment {
  id: string;
  title: string;
  summary: string;
  unitId: string;
  assignedBy: { name: string; role: string };
  /** ISO date (local, no time). */
  dueDate: string;
  dueLabel: string;
  note?: string;
  items: DemoAssignmentItem[];
}

export interface DemoTodaysPractice {
  kind: ActivityKind;
  refId: string;
  title: string;
  skill: SkillId;
  minutes: number;
  /** Coach-voice line explaining why this practice today. */
  why: string;
}

export interface DemoLearnerState {
  user: { id: string; firstName: string; role: string; organization: string };
  pathwayId: string;
  currentWeek: number;
  currentUnitId: string;
  completedUnitIds: string[];
  /** Completed activity ids in the current unit. */
  currentUnitCompletedActivityIds: string[];
  skills: Record<SkillId, DemoSkillProgress>;
  streakDays: number;
  weeklyGoal: { target: number; done: number };
  /** null for a learner with no trainer assignment yet (see freshLearnerState). */
  trainerAssignment: DemoTrainerAssignment | null;
  todaysPractice: DemoTodaysPractice;
}

/** Amanda always has an assignment, so callers can read it without a null check. */
export const DEMO_LEARNER: DemoLearnerState & { trainerAssignment: DemoTrainerAssignment } = {
  user: {
    id: "demo-amanda",
    firstName: "Amanda",
    role: "Director of outpatient nursing",
    organization: "Riverbend Health (fictional)",
  },
  pathwayId: "mi-for-leaders",
  currentWeek: 4,
  currentUnitId: "u04-focusing",
  completedUnitIds: ["u01-foundations", "u02-spirit", "u03-engaging"],
  currentUnitCompletedActivityIds: ["u04-a1", "u04-a2", "u04-a3"],
  skills: {
    oars: { level: 2, percent: 100, status: "complete" },
    engaging: { level: 3, percent: 40, status: "in-progress" },
    focusing: { level: 2, percent: 72, status: "in-progress" },
    evoking: { level: 1, percent: 48, status: "in-progress" },
    "change-talk": { level: 1, percent: 30, status: "in-progress" },
    "sustain-talk": { level: 1, percent: 20, status: "in-progress" },
    leadership: { level: 1, percent: 60, status: "in-progress" },
    discord: { level: 1, percent: 0, status: "locked" },
    planning: { level: 1, percent: 0, status: "locked" },
    "full-conversation": { level: 1, percent: 0, status: "locked" },
  },
  streakDays: 17,
  weeklyGoal: { target: 5, done: 3 },
  trainerAssignment: {
    id: "assign-week5-evoking",
    title: "Week 5 Evoking",
    summary: "2 short practices + 1 role-play",
    unitId: "u05-evoking-1",
    assignedBy: { name: "Dr. Rosa Lin", role: "MI trainer" },
    dueDate: "2026-10-09",
    dueLabel: "Due Friday",
    note: "Listen for the moment Josh's reasons start to shift. Bring one example to our group session.",
    items: [
      { kind: "drill", title: "Spot the change talk", refId: "drill-evoking-01", done: false },
      { kind: "drill", title: "Reflect it back", refId: "drill-evoking-03", done: false },
      { kind: "roleplay", title: "The reports are late again", refId: "PM-017", done: false },
    ],
  },
  todaysPractice: {
    kind: "drill",
    refId: "drill-evoking-05",
    title: "Responding to sustain talk",
    skill: "sustain-talk",
    minutes: 5,
    why: "One short drill on meeting pushback without arguing. It sets you up for this week's role-play.",
  },
};

/**
 * A brand-new learner on a pathway (MI for Leaders unless told otherwise): week 1, no streak, no progress, a weekly
 * goal of 0/3, no trainer assignment, and the pathway's first daily drill as
 * today's practice. Skills in the first unit start in progress; the rest are
 * locked. Pass `user` to fill in who they are.
 */
export function freshLearnerState(
  pathwayId: PathwayId = DEFAULT_PATHWAY_ID,
  user: Partial<DemoLearnerState["user"]> = {},
): DemoLearnerState {
  const pathway = getPathway(pathwayId);
  const firstUnit = pathway.units[0];
  const skills = Object.fromEntries(
    SKILLS.map((s) => [
      s.id,
      { level: 1, percent: 0, status: firstUnit.skills.includes(s.id) ? "in-progress" : "locked" } satisfies DemoSkillProgress,
    ]),
  ) as Record<SkillId, DemoSkillProgress>;

  const firstDrillId = dailyDrillOrder(pathway.id)[0];
  const firstDrill = getDrill(firstDrillId);
  const activity = firstUnit.activities.find((a) => a.kind === "drill" && a.refIds?.includes(firstDrillId));

  return {
    user: { id: "", firstName: "", role: "", organization: "", ...user },
    pathwayId: pathway.id,
    currentWeek: firstUnit.week,
    currentUnitId: firstUnit.id,
    completedUnitIds: [],
    currentUnitCompletedActivityIds: [],
    skills,
    streakDays: 0,
    weeklyGoal: { target: 3, done: 0 },
    trainerAssignment: null,
    todaysPractice: {
      kind: "drill",
      refId: firstDrillId,
      title: activity?.title ?? "Your first drill",
      skill: firstDrill?.skill ?? "oars",
      minutes: 2,
      why: "One short drill to start. Spotting the core skills comes before using them.",
    },
  };
}
