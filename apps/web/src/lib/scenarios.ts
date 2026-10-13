import {
  getScenario,
  scenarioFrame,
  SCENARIOS,
  SKILLS,
  type Difficulty,
  type ScenarioSpec,
  type Setting,
  type SkillId,
} from "@antelope/core";
import { AUDIENCES } from "@/lib/audiences";
import { getAllGuides, type Guide } from "@/lib/guides";

/**
 * What the scenario pages may show. `hiddenBackstory` is the role-player's secret and
 * spoils the practice, so it never leaves this module: pages and components take a
 * `PublicScenario`, which has no field for it (or for the voice settings).
 */
export type PublicScenario = Omit<ScenarioSpec, "hiddenBackstory" | "persona"> & {
  persona: Omit<ScenarioSpec["persona"], "voice" | "voiceNotes" | "avatarSeed">;
};

function toPublic(s: ScenarioSpec): PublicScenario {
  const { hiddenBackstory: _secret, persona, ...rest } = s;
  void _secret;
  return {
    ...rest,
    persona: { name: persona.name, role: persona.role, tenure: persona.tenure },
  };
}

export function getAllScenarios(): PublicScenario[] {
  return SCENARIOS.map(toPublic);
}

export function getPublicScenario(id: string): PublicScenario | undefined {
  const s = getScenario(id);
  return s ? toPublic(s) : undefined;
}

export const difficultyLabel: Record<Difficulty, string> = {
  intro: "Intro",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const DIFFICULTY_ORDER: Difficulty[] = ["intro", "intermediate", "advanced"];

export const scenarioGroups: { setting: Setting; heading: string; blurb: string; audiencePath: string }[] = [
  {
    setting: "workplace",
    heading: "Conversations with your team",
    blurb: "One-on-ones a manager, charge nurse, or coach has been putting off. You play the leader.",
    audiencePath: "/for/leaders",
  },
  {
    setting: "clinical",
    heading: "Patient conversations",
    blurb: "Visits where the patient isn't sure about the change. You play the clinician.",
    audiencePath: "/for/clinicians",
  },
];

/** Scenarios in one setting, easiest first. */
export function scenariosByDifficulty(setting: Setting): PublicScenario[] {
  return getAllScenarios()
    .filter((s) => s.setting === setting)
    .sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty));
}

export function skillName(id: SkillId): string {
  return SKILLS.find((s) => s.id === id)?.name ?? id;
}

export function skillTagline(id: SkillId): string {
  return SKILLS.find((s) => s.id === id)?.tagline ?? "";
}

/**
 * Search copy per scenario, written to read naturally. `h1` is the practice phrase,
 * `title` the page title (60 characters or fewer, no brand).
 */
export const SCENARIO_SEO: Record<string, { h1: string; title: string }> = {
  "EN-003": {
    h1: "Practice talking to a team member who has gone quiet",
    title: "Role-play: a team member who has gone quiet",
  },
  "PM-017": {
    h1: "Practice talking to an employee who keeps missing deadlines",
    title: "Role-play: an employee who keeps missing deadlines",
  },
  "BO-008": {
    h1: "Practice talking to an overwhelmed manager who won't delegate",
    title: "Role-play: an overwhelmed manager who won't delegate",
  },
  "CR-012": {
    h1: "Practice talking to an employee who resists a new workflow",
    title: "Role-play: an employee who resists a new workflow",
  },
  "DC-021": {
    h1: "Practice talking to a nurse who is angry about a staffing change",
    title: "Role-play: a nurse angry about a staffing change",
  },
  "SP-001": {
    h1: "Practice talking to an athlete whose nerves take over in games",
    title: "Role-play: an athlete whose nerves take over in games",
  },
  "SP-002": {
    h1: "Practice talking to a talented athlete whose attitude is hurting the team",
    title: "Role-play: a talented athlete hurting team morale",
  },
  "CL-101": {
    h1: "Practice talking to a new patient who arrives with a list of concerns",
    title: "Role-play: a new patient with a list of concerns",
  },
  "CL-102": {
    h1: "Practice talking to a patient who stopped their blood pressure medication",
    title: "Role-play: a patient who stopped blood pressure medication",
  },
  "CL-103": {
    h1: "Practice talking to a patient whose alcohol screen came back positive",
    title: "Role-play: a patient with a positive alcohol screen",
  },
  "CL-104": {
    h1: "Practice talking to a patient whose A1c keeps rising",
    title: "Role-play: a patient whose A1c keeps rising",
  },
  "CL-105": {
    h1: "Practice talking to a patient who smokes and is frustrated by a long wait",
    title: "Role-play: a patient who smokes after a long wait",
  },
};

/**
 * schema.org audienceType for a scenario page. The pathway's audience, unless the
 * scenario has its own frame (a sports scenario is for coaches, though it sits in
 * the leaders pathway).
 */
export function scenarioAudienceType(s: Pick<PublicScenario, "setting" | "frame">): string {
  if (scenarioFrame(s) === "sports") return "Coaches in school and college sports";
  return AUDIENCES[s.setting === "clinical" ? "clinicians" : "leaders"].audienceType;
}

export function seoFor(s: Pick<PublicScenario, "id" | "title" | "issue">) {
  return SCENARIO_SEO[s.id] ?? { h1: `Practice a conversation about ${s.issue.toLowerCase()}`, title: `Role-play: ${s.title}` };
}

/** Meta description: the practice phrase, who you'll talk to, and the level. */
export function scenarioDescription(s: PublicScenario): string {
  const { h1 } = seoFor(s);
  const level = difficultyLabel[s.difficulty].toLowerCase();
  const base = `${h1}. Try a free motivational interviewing role-play with ${s.persona.name}`;
  const withRole = `${base}, ${s.persona.role.split(",")[0].toLowerCase()}. Level: ${level}.`;
  return withRole.length <= 160 ? withRole : `${base}. Level: ${level}.`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Guides that teach each skill, best first. Slugs that don't exist are skipped. */
const SKILL_GUIDES: Partial<Record<SkillId, string[]>> = {
  oars: ["oars-motivational-interviewing", "reflective-listening-examples", "open-ended-questions-examples"],
  engaging: ["how-to-practice-motivational-interviewing", "what-is-motivational-interviewing"],
  focusing: ["what-is-motivational-interviewing"],
  evoking: ["change-talk-vs-sustain-talk", "open-ended-questions-examples"],
  planning: ["how-to-practice-motivational-interviewing"],
  "change-talk": ["change-talk-vs-sustain-talk"],
  "sustain-talk": ["responding-to-sustain-talk", "change-talk-vs-sustain-talk"],
  discord: ["responding-to-sustain-talk"],
  leadership: ["motivational-interviewing-for-managers"],
};

/** Up to `limit` published guides matched to the scenario's target skills, primary skill first. */
export function guidesForScenario(s: PublicScenario, limit = 3): Guide[] {
  const published = getAllGuides();
  const skills = [s.primaryChallenge, ...s.targetSkills.filter((k) => k !== s.primaryChallenge)];
  const out: Guide[] = [];
  for (const skill of skills) {
    for (const slug of SKILL_GUIDES[skill] ?? []) {
      const g = published.find((x) => x.slug === slug);
      if (g && !out.includes(g)) out.push(g);
    }
  }
  return out.slice(0, limit);
}
