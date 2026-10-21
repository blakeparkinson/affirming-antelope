// DRAFT — pending trainer review
// Learn activities point at Lesson ids; drill activities at Drill ids;
// roleplay activities at a single ScenarioSpec id.

import type { PathUnit, Pathway, PathwayId } from "./types";
import { MI_FOR_CLINICIANS } from "./pathway-clinicians";

export { MI_FOR_CLINICIANS };

export const MI_FOR_LEADERS: Pathway = {
  id: "mi-for-leaders",
  title: "MI for Leaders",
  setting: "workplace",
  tagline: "Performance, motivation, and burnout conversations with the people you lead.",
  audience: "Supervisors, athletic coaches, nurses, and more",
  units: [
    {
      week: 1,
      id: "u01-foundations",
      process: "foundations",
      title: "Overview",
      subtitle: "What MI is, why it works, and what it can do for you as a leader.",
      skills: ["engaging"],
      activities: [
        { id: "u01-a1", kind: "learn", title: "What MI is, and why it works", minutes: 5, refIds: ["lesson-u01-what-mi-is"] },
        { id: "u01-a5", kind: "drill", title: "Righting reflex or curiosity?", minutes: 3, refIds: ["drill-righting-reflex-01"] },
      ],
    },
    {
      week: 2,
      id: "u02-spirit",
      title: "Spirit of MI",
      subtitle: "Guiding, directing, and following, and your role when you wear the MI hat.",
      skills: ["leadership", "engaging"],
      activities: [
        { id: "u02-a4", kind: "learn", title: "Guiding, directing, and following", minutes: 4, refIds: ["lesson-u02-styles"] },
        { id: "u02-a1", kind: "learn", title: "The spirit behind the skills", minutes: 5, refIds: ["lesson-u02-spirit"] },
        { id: "u02-a2", kind: "drill", title: "Expectations with partnership", minutes: 3, refIds: ["drill-leadership-01"] },
      ],
    },
    {
      week: 3,
      id: "u03-engaging",
      process: "engaging",
      title: "Engaging and OARS",
      subtitle: "Build trust with the four core skills.",
      skills: ["engaging", "oars"],
      activities: [
        { id: "u03-a1", kind: "learn", title: "Building the working relationship", minutes: 5, refIds: ["lesson-u03-engaging"] },
        { id: "u01-a2", kind: "learn", title: "OARS: four core skills", minutes: 4, refIds: ["lesson-u01-oars"] },
        { id: "u01-a3", kind: "drill", title: "Spot the open question", minutes: 3, refIds: ["drill-oars-01", "drill-oars-02", "drill-oars-03"] },
        { id: "u01-a4", kind: "drill", title: "Ask, reflect, affirm", minutes: 5, refIds: ["drill-oars-04", "drill-oars-05", "drill-oars-06"] },
        { id: "u02-a3", kind: "drill", title: "Pull it together with a summary", minutes: 4, refIds: ["drill-oars-07"] },
        { id: "u03-a2", kind: "drill", title: "Opening without alarm", minutes: 3, refIds: ["drill-engaging-01"] },
        { id: "u03-a3", kind: "drill", title: "The feeling under the complaint", minutes: 5, refIds: ["drill-engaging-02", "drill-engaging-03"] },
        { id: "u03-a4", kind: "roleplay", title: "Quieter than usual", minutes: 8, refIds: ["EN-003"] },
      ],
    },
    {
      week: 4,
      id: "u04-focusing",
      process: "focusing",
      title: "Focusing",
      subtitle: "Agree on what this conversation is about.",
      skills: ["focusing"],
      activities: [
        { id: "u04-a1", kind: "learn", title: "Agreeing on what this is about", minutes: 5, refIds: ["lesson-u04-focusing"] },
        { id: "u04-a2", kind: "drill", title: "Sharing the agenda", minutes: 4, refIds: ["drill-focusing-01", "drill-focusing-02"] },
        { id: "u04-a3", kind: "drill", title: "Ask before you tell", minutes: 3, refIds: ["drill-focusing-04"] },
        { id: "u04-a4", kind: "drill", title: "When everything is on fire", minutes: 3, refIds: ["drill-focusing-03"] },
        { id: "u04-a5", kind: "roleplay", title: "I'll just do it myself", minutes: 10, refIds: ["BO-008"] },
      ],
    },
    {
      week: 5,
      id: "u05-evoking-1",
      process: "evoking",
      title: "Evoking I",
      subtitle: "Recognize and respond to change talk and sustain talk.",
      skills: ["change-talk", "sustain-talk"],
      activities: [
        { id: "u05-a1", kind: "learn", title: "Hearing change talk", minutes: 6, refIds: ["lesson-u05-change-talk"] },
        { id: "u06-a1", kind: "learn", title: "Responding to sustain talk", minutes: 4, refIds: ["lesson-u06-sustain-talk"] },
        { id: "u05-a2", kind: "drill", title: "Spot the change talk", minutes: 4, refIds: ["drill-evoking-01", "drill-evoking-02", "drill-change-talk-01"] },
        { id: "u05-a3", kind: "drill", title: "Reflect it back", minutes: 4, refIds: ["drill-evoking-03", "drill-change-talk-02"] },
        { id: "u06-a2", kind: "drill", title: "Spot the sustain talk", minutes: 3, refIds: ["drill-sustain-talk-01", "drill-sustain-talk-02"] },
        { id: "u06-a3", kind: "drill", title: "Both sides, change last", minutes: 5, refIds: ["drill-sustain-talk-03", "drill-evoking-05", "drill-evoking-06"] },
        { id: "u05-a5", kind: "roleplay", title: "The reports are late again", minutes: 10, refIds: ["PM-017"] },
      ],
    },
    {
      week: 6,
      id: "u06-evoking-2",
      process: "evoking",
      title: "Evoking II",
      subtitle: "Draw out change talk with evocative questions and rulers.",
      skills: ["evoking", "change-talk"],
      activities: [
        { id: "u06-a5", kind: "learn", title: "Eliciting change talk", minutes: 5, refIds: ["lesson-u06-eliciting"] },
        { id: "u05-a4", kind: "drill", title: "Ask for more", minutes: 4, refIds: ["drill-evoking-04", "drill-change-talk-03"] },
        { id: "u06-a6", kind: "drill", title: "Importance and confidence rulers", minutes: 4, refIds: ["drill-evoking-ruler-01", "drill-evoking-ruler-02"] },
        { id: "u06-a7", kind: "roleplay", title: "Great in practice, gone in games", minutes: 10, refIds: ["SP-001"] },
      ],
    },
    {
      week: 7,
      id: "u07-planning",
      process: "planning",
      title: "Planning",
      subtitle: "When they're ready, help them shape a plan they own.",
      skills: ["planning", "change-talk"],
      activities: [
        { id: "u07-a1", kind: "learn", title: "Planning when they're ready", minutes: 4, refIds: ["lesson-u07-planning"] },
        { id: "u07-a2", kind: "drill", title: "Are they ready?", minutes: 3, refIds: ["drill-planning-01"] },
        { id: "u07-a3", kind: "drill", title: "Their plan, their words", minutes: 5, refIds: ["drill-planning-02", "drill-planning-03"] },
        { id: "u07-a4", kind: "roleplay", title: "The new check-in kiosks", minutes: 12, refIds: ["CR-012"] },
      ],
    },
    {
      week: 8,
      id: "u08-integration",
      title: "Putting it all together",
      subtitle: "Full role-plays, start to finish.",
      skills: ["full-conversation"],
      activities: [
        { id: "u08-a1", kind: "learn", title: "Putting the four processes together", minutes: 3, refIds: ["lesson-u08-integration"] },
        { id: "u08-a2", kind: "drill", title: "The transitional summary", minutes: 4, refIds: ["drill-full-conversation-01"] },
        { id: "u08-a3", kind: "roleplay", title: "The reports are late again", minutes: 12, refIds: ["PM-017"] },
        { id: "u08-a4", kind: "roleplay", title: "I'll just do it myself", minutes: 12, refIds: ["BO-008"] },
        { id: "u08-a5", kind: "roleplay", title: "Talented, but dragging the team down", minutes: 12, refIds: ["SP-002"] },
      ],
    },
    {
      week: 9,
      id: "u09-self-coding",
      title: "Self-Coding",
      subtitle: "Listen back and notice your own habits.",
      skills: ["oars", "full-conversation"],
      activities: [
        { id: "u09-a1", kind: "learn", title: "Coding your own conversations", minutes: 4, refIds: ["lesson-u09-self-coding"] },
        { id: "u09-a2", kind: "drill", title: "Name the move", minutes: 4, refIds: ["drill-oars-02", "drill-oars-03", "drill-engaging-01"] },
        { id: "u09-a3", kind: "roleplay", title: "Quieter than usual, then code it", minutes: 10, refIds: ["EN-003"] },
      ],
    },
    {
      week: 10,
      id: "u10-leadership",
      title: "Leadership & MI",
      subtitle: "Hold clear expectations and leave room for their choices.",
      skills: ["leadership", "planning"],
      activities: [
        { id: "u10-a1", kind: "learn", title: "MI when you're the boss", minutes: 4, refIds: ["lesson-u10-leadership"] },
        { id: "u10-a2", kind: "drill", title: "Firm on what, open on how", minutes: 5, refIds: ["drill-leadership-02", "drill-leadership-03"] },
        { id: "u10-a3", kind: "drill", title: "Autonomy under pressure", minutes: 3, refIds: ["drill-sustain-talk-04"] },
        { id: "u10-a4", kind: "roleplay", title: "The new check-in kiosks", minutes: 12, refIds: ["CR-012"] },
      ],
    },
    {
      week: 11,
      id: "u11-advanced-1",
      title: "Advanced Practice I",
      subtitle: "When the pushback is aimed at you.",
      skills: ["discord", "engaging"],
      activities: [
        { id: "u11-a1", kind: "learn", title: "Working with discord", minutes: 3, refIds: ["lesson-u11-discord"] },
        { id: "u11-a2", kind: "drill", title: "Discord or sustain talk?", minutes: 3, refIds: ["drill-discord-01", "drill-discord-02"] },
        { id: "u11-a3", kind: "drill", title: "Step beside, not against", minutes: 5, refIds: ["drill-discord-03", "drill-discord-04"] },
        { id: "u11-a4", kind: "roleplay", title: "Decided without us", minutes: 12, refIds: ["DC-021"] },
      ],
    },
    {
      week: 12,
      id: "u12-advanced-2",
      title: "Advanced Practice II",
      subtitle: "Stay steady when it gets hard.",
      skills: ["full-conversation", "discord", "sustain-talk"],
      activities: [
        { id: "u12-a1", kind: "learn", title: "Staying steady in hard conversations", minutes: 3, refIds: ["lesson-u12-staying-steady"] },
        { id: "u12-a2", kind: "drill", title: "Mixed review", minutes: 6, refIds: ["drill-evoking-05", "drill-discord-04", "drill-leadership-03"] },
        { id: "u12-a3", kind: "roleplay", title: "Decided without us", minutes: 12, refIds: ["DC-021"] },
        { id: "u12-a4", kind: "roleplay", title: "I'll just do it myself", minutes: 12, refIds: ["BO-008"] },
      ],
    },
  ],
};

/**
 * Every pathway by id. Unit, activity, and lesson ids are unique across pathways,
 * so getUnit works without knowing which pathway a unit belongs to.
 */
export const PATHWAYS: Partial<Record<PathwayId, Pathway>> = {
  "mi-for-leaders": MI_FOR_LEADERS,
  "mi-for-clinicians": MI_FOR_CLINICIANS,
};

export const DEFAULT_PATHWAY_ID: PathwayId = "mi-for-leaders";

export function getPathway(id: PathwayId | string | null | undefined): Pathway {
  return (id && PATHWAYS[id as PathwayId]) || MI_FOR_LEADERS;
}

export function listPathways(): Pathway[] {
  return Object.values(PATHWAYS).filter((p): p is Pathway => Boolean(p));
}

export function getUnit(id: string): PathUnit | undefined {
  for (const p of listPathways()) {
    const u = p.units.find((x) => x.id === id);
    if (u) return u;
  }
  return undefined;
}

/** Defaults to MI for Leaders for older callers that only know a week number. */
export function getUnitByWeek(week: number, pathwayId: PathwayId = DEFAULT_PATHWAY_ID): PathUnit | undefined {
  return getPathway(pathwayId).units.find((u) => u.week === week);
}
