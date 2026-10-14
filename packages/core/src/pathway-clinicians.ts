// DRAFT — pending trainer review
// The 8-week MI for Clinicians pathway. Shorter than MI for Leaders because
// clinicians have less protected time. Every id is prefixed "cl-" so unit,
// activity, and lesson ids stay unique across pathways.

import type { Pathway } from "./types";

export const MI_FOR_CLINICIANS: Pathway = {
  id: "mi-for-clinicians",
  title: "MI for Clinicians",
  setting: "clinical",
  tagline: "Medication, smoking, drinking, and diabetes conversations that fit in a 15-minute visit.",
  audience: "Physicians, NPs, PAs, nurses, pharmacists, therapists, and health coaches",
  units: [
    {
      week: 1,
      id: "cl-u1-foundations",
      title: "Overview",
      subtitle: "What MI is, why it works, and what it can do for you as a clinician.",
      skills: ["engaging"],
      activities: [
        { id: "cl-u1-a1", kind: "learn", title: "What MI is, and why it works", minutes: 5, refIds: ["lesson-cl-u1-what-mi-is"] },
        { id: "cl-u2-a3", kind: "drill", title: "Hold the correction", minutes: 3, refIds: ["drill-cl-sustain-talk-01"] },
      ],
    },
    {
      week: 2,
      id: "cl-u2-spirit",
      title: "Spirit of MI",
      subtitle: "Guiding, directing, and following, and your role when you wear the MI hat.",
      skills: ["engaging"],
      activities: [
        { id: "cl-u2-a5", kind: "learn", title: "Guiding, directing, and following", minutes: 4, refIds: ["lesson-cl-u2-styles"] },
        { id: "cl-u2-a1", kind: "learn", title: "The spirit behind the skills", minutes: 5, refIds: ["lesson-cl-u2-spirit"] },
        { id: "cl-u2-a2", kind: "learn", title: "MI in a 15-minute visit", minutes: 4, refIds: ["lesson-cl-u2-short-visit"] },
      ],
    },
    {
      week: 3,
      id: "cl-u3-engaging",
      title: "Engaging and OARS",
      subtitle: "Build rapport in the first few minutes with the four core skills.",
      skills: ["engaging", "oars"],
      activities: [
        { id: "cl-u3-a1", kind: "learn", title: "Rapport, fast", minutes: 5, refIds: ["lesson-cl-u3-engaging"] },
        { id: "cl-u1-a2", kind: "learn", title: "OARS: four core skills", minutes: 4, refIds: ["lesson-cl-u1-oars"] },
        { id: "cl-u1-a3", kind: "drill", title: "Spot the skill", minutes: 3, refIds: ["drill-cl-oars-01", "drill-cl-oars-02", "drill-cl-oars-03"] },
        { id: "cl-u1-a4", kind: "drill", title: "Reflect and summarize", minutes: 4, refIds: ["drill-cl-oars-04", "drill-cl-oars-05"] },
        { id: "cl-u3-a2", kind: "drill", title: "The feeling under the complaint", minutes: 4, refIds: ["drill-cl-engaging-02", "drill-cl-engaging-03"] },
        { id: "cl-u3-a4", kind: "roleplay", title: "I made a list", minutes: 8, refIds: ["CL-101"] },
      ],
    },
    {
      week: 4,
      id: "cl-u4-focusing",
      title: "Focusing",
      subtitle: "Many problems, one visit. Agree on where to start.",
      skills: ["focusing"],
      activities: [
        { id: "cl-u4-a1", kind: "learn", title: "One visit, many problems", minutes: 5, refIds: ["lesson-cl-u4-focusing"] },
        { id: "cl-u2-a4", kind: "drill", title: "Start with their agenda", minutes: 3, refIds: ["drill-cl-engaging-01", "drill-cl-focusing-01"] },
        { id: "cl-u4-a2", kind: "drill", title: "Map the agenda", minutes: 4, refIds: ["drill-cl-focusing-01", "drill-cl-focusing-03"] },
        { id: "cl-u4-a3", kind: "drill", title: "Ask before you raise it", minutes: 3, refIds: ["drill-cl-focusing-02"] },
        { id: "cl-u4-a4", kind: "roleplay", title: "I made a list", minutes: 8, refIds: ["CL-101"] },
      ],
    },
    {
      week: 5,
      id: "cl-u5-evoking",
      title: "Evoking I",
      subtitle: "Recognize and respond to change talk and sustain talk.",
      skills: ["change-talk", "sustain-talk", "discord"],
      activities: [
        { id: "cl-u5-a1", kind: "learn", title: "Hearing change talk", minutes: 6, refIds: ["lesson-cl-u5-change-talk"] },
        { id: "cl-u6-a1", kind: "learn", title: "The righting reflex in clinical care", minutes: 4, refIds: ["lesson-cl-u6-sustain-discord"] },
        { id: "cl-u5-a2", kind: "drill", title: "Spot the change talk", minutes: 4, refIds: ["drill-cl-change-talk-01", "drill-cl-change-talk-02", "drill-cl-evoking-01"] },
        { id: "cl-u5-a4", kind: "drill", title: "Reflect it back", minutes: 5, refIds: ["drill-cl-change-talk-03", "drill-cl-change-talk-04"] },
        { id: "cl-u6-a2", kind: "drill", title: "Both sides, change last", minutes: 5, refIds: ["drill-cl-sustain-talk-02", "drill-cl-sustain-talk-03", "drill-cl-evoking-05"] },
        { id: "cl-u6-a3", kind: "drill", title: "Step beside, not against", minutes: 5, refIds: ["drill-cl-discord-01", "drill-cl-discord-02", "drill-cl-discord-03"] },
        { id: "cl-u6-a4", kind: "roleplay", title: "I feel fine", minutes: 10, refIds: ["CL-102"] },
      ],
    },
    {
      week: 6,
      id: "cl-u6-sustain-discord",
      title: "Evoking II",
      subtitle: "Draw out change talk with evocative questions and rulers.",
      skills: ["evoking", "change-talk"],
      activities: [
        { id: "cl-u6-a5", kind: "learn", title: "Eliciting change talk", minutes: 5, refIds: ["lesson-cl-u6-eliciting"] },
        { id: "cl-u5-a3", kind: "drill", title: "Importance and confidence rulers", minutes: 4, refIds: ["drill-cl-evoking-02", "drill-cl-evoking-03"] },
        { id: "cl-u6-a6", kind: "drill", title: "Ask for more", minutes: 3, refIds: ["drill-cl-evoking-04"] },
        { id: "cl-u5-a5", kind: "roleplay", title: "I answered honestly", minutes: 10, refIds: ["CL-103"] },
      ],
    },
    {
      week: 7,
      id: "cl-u7-informing",
      title: "Planning",
      subtitle: "When they're ready, a plan in their words, with information offered the MI way.",
      skills: ["planning"],
      activities: [
        { id: "cl-u8-a1", kind: "learn", title: "Planning when they're ready", minutes: 4, refIds: ["lesson-cl-u8-planning"] },
        { id: "cl-u7-a1", kind: "learn", title: "Elicit-Provide-Elicit", minutes: 4, refIds: ["lesson-cl-u7-giving-information"] },
        { id: "cl-u8-a2", kind: "drill", title: "Are they ready?", minutes: 4, refIds: ["drill-cl-planning-01", "drill-cl-planning-04"] },
        { id: "cl-u7-a2", kind: "drill", title: "Ask first", minutes: 3, refIds: ["drill-cl-focusing-04", "drill-cl-planning-02"] },
        { id: "cl-u7-a3", kind: "drill", title: "Provide, then ask", minutes: 4, refIds: ["drill-cl-planning-03", "drill-cl-planning-05"] },
        { id: "cl-u7-a4", kind: "roleplay", title: "A drawer full of handouts", minutes: 10, refIds: ["CL-104"] },
      ],
    },
    {
      week: 8,
      id: "cl-u8-planning",
      title: "Putting it all together",
      subtitle: "Full role-plays, the whole visit start to finish.",
      skills: ["full-conversation"],
      activities: [
        { id: "cl-u8-a6", kind: "learn", title: "Putting the four processes together", minutes: 3, refIds: ["lesson-cl-u8-together"] },
        { id: "cl-u8-a3", kind: "drill", title: "Summaries that move the visit", minutes: 5, refIds: ["drill-cl-full-conversation-01", "drill-cl-full-conversation-02"] },
        { id: "cl-u8-a4", kind: "drill", title: "Mixed review", minutes: 5, refIds: ["drill-cl-sustain-talk-04", "drill-cl-discord-04"] },
        { id: "cl-u8-a5", kind: "roleplay", title: "Fifty minutes", minutes: 12, refIds: ["CL-105"] },
        { id: "cl-u8-a7", kind: "roleplay", title: "I feel fine", minutes: 10, refIds: ["CL-102"] },
      ],
    },
  ],
};
