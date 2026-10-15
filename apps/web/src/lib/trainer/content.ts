// Plain-language labels and core-content lookups shared by the trainer dashboard.
// Mirrors apps/mobile/src/components/practice-loop/moves.ts so trainers and learners
// see the same words for the same things. No numbers are ever shown as grades.

import {
  DRILLS,
  LESSONS,
  SCENARIOS,
  SKILLS,
  counterpartLabel,
  getDrill,
  getLesson,
  getPathway,
  getScenario,
  getSkill,
  getUnit,
  type ActivityKind,
  type ClientTalk,
  type Difficulty,
  type LearnerMove,
  type MoveTallies,
  type Frame,
  type Setting,
  type SkillId,
  type Stance,
} from "@antelope/core";

export type MoveFamily = "question" | "reflection" | "support" | "inconsistent" | "neutral";

export const MOVE: Record<LearnerMove, { label: string; family: MoveFamily }> = {
  "open-question": { label: "Open question", family: "question" },
  "closed-question": { label: "Closed question", family: "question" },
  "simple-reflection": { label: "Simple reflection", family: "reflection" },
  "complex-reflection": { label: "Complex reflection", family: "reflection" },
  summary: { label: "Summary", family: "reflection" },
  affirmation: { label: "Affirmation", family: "support" },
  "emphasize-autonomy": { label: "Autonomy support", family: "support" },
  "seeking-collaboration": { label: "Seeking collaboration", family: "support" },
  "advice-with-permission": { label: "Advice with permission", family: "support" },
  "giving-information": { label: "Sharing information", family: "neutral" },
  other: { label: "Something else", family: "neutral" },
  "advice-without-permission": { label: "Advice without asking", family: "inconsistent" },
  confront: { label: "Pushing back", family: "inconsistent" },
};

export const FAMILY: Record<MoveFamily, { label: string; color: string }> = {
  question: { label: "Questions", color: "var(--move-question)" },
  reflection: { label: "Reflections", color: "var(--move-reflection)" },
  support: { label: "Affirm & autonomy", color: "var(--move-support)" },
  inconsistent: { label: "Telling or pushing", color: "var(--move-inconsistent)" },
  neutral: { label: "Other", color: "var(--move-neutral)" },
};

export function moveLabel(m?: LearnerMove): string {
  return m ? (MOVE[m]?.label ?? "Response") : "Response";
}

export type ZoneKey = "change" | "mixed" | "hold";

export const ZONE: Record<ZoneKey, { label: string }> = {
  change: { label: "Open to change" },
  mixed: { label: "Mixed" },
  hold: { label: "Holding on" },
};

export function zoneOf(intensity: number): ZoneKey {
  if (intensity >= 0.67) return "change";
  if (intensity <= -0.67) return "hold";
  return "mixed";
}

export function stanceLabel(s?: Stance, intensity?: number): string {
  if (s === "discord") return "Pushing back";
  if (s === "change") return "Open to change";
  if (s === "sustain") return "Holding on";
  if (s === "ambivalent") return "Mixed";
  return ZONE[zoneOf(intensity ?? 0)].label;
}

export const TALK: Record<ClientTalk, { label: string }> = {
  change: { label: "Change talk" },
  sustain: { label: "Sustain talk" },
  neutral: { label: "Neutral" },
};

export const TALLY_ROWS: { key: keyof MoveTallies; label: string; family: MoveFamily }[] = [
  { key: "openQuestions", label: "Open questions", family: "question" },
  { key: "closedQuestions", label: "Closed questions", family: "question" },
  { key: "simpleReflections", label: "Simple reflections", family: "reflection" },
  { key: "complexReflections", label: "Complex reflections", family: "reflection" },
  { key: "summaries", label: "Summaries", family: "reflection" },
  { key: "affirmations", label: "Affirmations", family: "support" },
  { key: "autonomySupport", label: "Autonomy support", family: "support" },
  { key: "miInconsistent", label: "Telling or pushing", family: "inconsistent" },
];

export const FEELING: Record<"rough" | "mixed" | "solid", string> = {
  rough: "Rough",
  mixed: "Mixed",
  solid: "Solid",
};

export const DIFFICULTY: Record<Difficulty, string> = {
  intro: "Intro",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// ---------------------------------------------------------------------------
// Trainer rating: a qualitative level, never a number.
// ---------------------------------------------------------------------------

export const RATINGS = [
  { id: "emerging", label: "Emerging", hint: "The skill is starting to show up." },
  { id: "developing", label: "Developing", hint: "Present, not yet consistent." },
  { id: "proficient", label: "Proficient", hint: "Reliable in this kind of conversation." },
  { id: "strong", label: "Strong", hint: "Skilful and flexible under pressure." },
] as const;

export type Rating = (typeof RATINGS)[number]["id"];

export function ratingLabel(r?: string | null): string | null {
  return RATINGS.find((x) => x.id === r)?.label ?? null;
}

// ---------------------------------------------------------------------------
// Content catalog for pickers
// ---------------------------------------------------------------------------

export const SKILL_OPTIONS = SKILLS.map((s) => ({ id: s.id, name: s.name, tagline: s.tagline }));

export function skillName(id?: string | null): string {
  if (!id) return "";
  try {
    return getSkill(id as SkillId)?.name ?? id;
  } catch {
    return id;
  }
}

/**
 * The label for the other person in a conversation: "Patient" for clinical, "Employee" for
 * workplace, "Athlete" for sports. Pass scenarioFrame(scenario) for a role-play.
 */
export function counterpartOf(frame: Frame | undefined): string {
  return counterpartLabel(frame ?? "workplace");
}

export interface PickerCatalog {
  setting: Setting;
  pathwayId: string;
  pathwayTitle: string;
  /** Skills with at least one drill in this setting, in SKILLS order. */
  drillSkills: SkillId[];
  /** Drill count per skill, this setting only. */
  drillCounts: Partial<Record<SkillId, number>>;
  /** Lessons from this pathway, with the week and unit they sit in. */
  lessons: { id: string; title: string; week: number; unitTitle: string }[];
  drills: { id: string; skill: SkillId; level: number; context: string; prompt: string; instruction: string }[];
  scenarios: {
    id: string;
    title: string;
    context: string;
    issue: string;
    persona: string;
    personaName: string;
    brief: string;
    goal: string;
    difficulty: Difficulty;
    skill: SkillId;
  }[];
}

/**
 * Everything a trainer can pick for a cohort on this pathway: the pathway's lessons, and
 * only the drills and role-plays written for its setting (clinical vs workplace).
 */
export function catalogFor(pathwayId: string | null | undefined): PickerCatalog {
  const pathway = getPathway(pathwayId);
  const setting = pathway.setting;
  const drills = DRILLS.filter((d) => d.setting === setting);
  const drillCounts: Partial<Record<SkillId, number>> = {};
  for (const d of drills) drillCounts[d.skill] = (drillCounts[d.skill] ?? 0) + 1;
  return {
    setting,
    pathwayId: pathway.id,
    pathwayTitle: pathway.title,
    drillSkills: SKILLS.map((s) => s.id).filter((id) => (drillCounts[id] ?? 0) > 0),
    drillCounts,
    lessons: LESSONS.flatMap((l) => {
      const unit = pathway.units.find((u) => u.id === l.unitId);
      return unit ? [{ id: l.id, title: l.title, week: unit.week, unitTitle: unit.title }] : [];
    }).sort((a, b) => a.week - b.week),
    drills: drills.map((d) => ({
      id: d.id,
      skill: d.skill,
      level: d.level,
      context: d.context,
      prompt: d.prompt,
      instruction: d.instruction,
    })),
    scenarios: SCENARIOS.filter((s) => s.setting === setting).map((s) => ({
      id: s.id,
      title: s.title,
      context: s.context,
      issue: s.issue,
      persona: `${s.persona.name}, ${s.persona.role}`,
      personaName: s.persona.name,
      brief: s.learnerBrief,
      goal: s.learnerGoal,
      difficulty: s.difficulty,
      skill: s.primaryChallenge,
    })),
  };
}

/** Human title for a content reference. */
export function refTitle(kind: string | null | undefined, ref: string | null | undefined): string {
  if (!kind || !ref) return "";
  if (kind === "drill") {
    const d = getDrill(ref);
    return d ? `${skillName(d.skill)} drill: ${d.instruction.replace(/\.$/, "")}` : ref;
  }
  if (kind === "roleplay") {
    const s = getScenario(ref);
    return s ? `Role-play: ${s.title}` : ref;
  }
  if (kind === "learn") {
    const l = getLesson(ref);
    return l ? `Lesson: ${l.title}` : ref;
  }
  return ref;
}

// ---------------------------------------------------------------------------
// Assignment items
// ---------------------------------------------------------------------------

export type ItemKind = "drill" | "roleplay" | "learn" | "any-drill" | "any-roleplay";

export interface ItemDraft {
  kind: ItemKind;
  refId: string | null;
  skill: SkillId | null;
  quantity: number;
}

export function itemTitle(i: ItemDraft): string {
  switch (i.kind) {
    case "any-drill":
      return `${i.quantity} short ${i.quantity === 1 ? "practice" : "practices"}${i.skill ? ` on ${skillName(i.skill)}` : ""}`;
    case "any-roleplay":
      return `${i.quantity} AI ${i.quantity === 1 ? "role-play" : "role-plays"}${i.skill ? ` on ${skillName(i.skill)}` : ""}`;
    case "drill": {
      const d = i.refId ? getDrill(i.refId) : undefined;
      return d ? d.instruction.replace(/\.$/, "") : "Short practice";
    }
    case "roleplay": {
      const s = i.refId ? getScenario(i.refId) : undefined;
      return s ? `${s.title}` : "Role-play";
    }
    case "learn": {
      const l = i.refId ? getLesson(i.refId) : undefined;
      return l ? l.title : "Lesson";
    }
  }
}

export function itemDetail(i: ItemDraft): string {
  switch (i.kind) {
    case "any-drill":
      return "Any drills the learner chooses";
    case "any-roleplay":
      return "Any role-play the learner chooses";
    case "drill": {
      const d = i.refId ? getDrill(i.refId) : undefined;
      return d ? `${skillName(d.skill)} · ${d.context}` : "";
    }
    case "roleplay": {
      const s = i.refId ? getScenario(i.refId) : undefined;
      return s ? `${s.persona.name} · ${s.context} · ${DIFFICULTY[s.difficulty]}` : "";
    }
    case "learn": {
      const l = i.refId ? getLesson(i.refId) : undefined;
      const unit = l ? getUnit(l.unitId) : undefined;
      return unit ? `Week ${unit.week} · ${unit.title}` : "";
    }
  }
}

export function itemActivityKind(kind: ItemKind): ActivityKind {
  return kind === "any-drill" ? "drill" : kind === "any-roleplay" ? "roleplay" : kind;
}

/** "2 short practices + 1 role-play + 1 lesson" */
export function summarizeItems(items: ItemDraft[]): string {
  let drills = 0;
  let roleplays = 0;
  let lessons = 0;
  for (const i of items) {
    const k = itemActivityKind(i.kind);
    if (k === "drill") drills += i.quantity;
    else if (k === "roleplay") roleplays += i.quantity;
    else lessons += i.quantity;
  }
  const parts: string[] = [];
  if (drills) parts.push(`${drills} short ${drills === 1 ? "practice" : "practices"}`);
  if (roleplays) parts.push(`${roleplays} ${roleplays === 1 ? "role-play" : "role-plays"}`);
  if (lessons) parts.push(`${lessons} ${lessons === 1 ? "lesson" : "lessons"}`);
  return parts.join(" + ");
}

/**
 * Validates an item against core content. Returns an error message or null. With a
 * pathway, the item must also belong to it: drills and role-plays of its setting,
 * lessons from its units.
 */
export function validateItem(i: ItemDraft, pathwayId?: string | null): string | null {
  const pathway = pathwayId ? getPathway(pathwayId) : null;
  if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 50) return "Pick between 1 and 50.";
  if (i.kind === "any-drill" || i.kind === "any-roleplay") {
    if (i.refId) return "Unexpected content id.";
    if (i.skill && !SKILLS.some((s) => s.id === i.skill)) return "Unknown skill.";
    if (pathway && i.kind === "any-drill" && i.skill && !DRILLS.some((d) => d.setting === pathway.setting && d.skill === i.skill)) {
      return `${pathway.title} has no drills on that skill.`;
    }
    if (pathway && i.kind === "any-roleplay" && i.skill && !SCENARIOS.some((s) => s.setting === pathway.setting && s.primaryChallenge === i.skill)) {
      return `${pathway.title} has no role-plays on that skill.`;
    }
    return null;
  }
  if (!i.refId) return "Pick something to practice.";
  if (i.kind === "drill") {
    const d = getDrill(i.refId);
    if (!d) return "Unknown drill.";
    if (pathway && d.setting !== pathway.setting) return `That drill isn't part of ${pathway.title}.`;
  }
  if (i.kind === "roleplay") {
    const s = getScenario(i.refId);
    if (!s) return "Unknown role-play.";
    if (pathway && s.setting !== pathway.setting) return `That role-play isn't part of ${pathway.title}.`;
  }
  if (i.kind === "learn") {
    const l = getLesson(i.refId);
    if (!l) return "Unknown lesson.";
    if (pathway && !pathway.units.some((u) => u.id === l.unitId)) return `That lesson isn't part of ${pathway.title}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dates (relative, human)
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Due today", "Due Friday", "Due Oct 24", "Was due Tuesday". */
export function dueLabel(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  const days = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1 && days < 7) return `Due ${weekday}`;
  if (days < 0 && days > -7) return `Was due ${days === -1 ? "yesterday" : weekday}`;
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return days < 0 ? `Was due ${md}` : `Due ${md}`;
}

/** "just now", "20 min ago", "19 hours ago", "3 days ago", "Sep 28". */
export function ago(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "Never";
  const ms = now.getTime() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(h / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function duration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.round(sec / 60);
  return m >= 1 ? `${m} min` : `${sec} sec`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => !/^(dr|mr|ms|mrs)\.?$/i.test(p));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** True when `iso` is more than `graceMs` in the past. */
export function isOverdue(iso: string | null | undefined, graceMs = 0): boolean {
  return !!iso && new Date(iso).getTime() < Date.now() - graceMs;
}
