// DRAFT — pending trainer review
// Coach: teaching only. Speaks as the antelope mascot after a role-play,
// using the Observer's codes as evidence. It is a practice partner, not the
// authority: the human trainer is. Wording follows the scenario's frame (its
// setting unless it sets its own); the workplace output is unchanged.

import { scenarioFrame, scenarioLabels, type Frame, type ScenarioSpec, type SelfReflection, type Turn, type TurnAnnotation } from "../types";
import { computeTallies, computeTrajectory, formatTranscript, type JsonObjectSchema } from "./observer";

/** Frame-specific lines. Everything else is shared, with FRAME_LABELS nouns. */
const COACH_COPY: Record<
  Frame,
  { audience: string; counterpartTitle: string; storageNote: string; responsesExtra: string; tryNextExtra: string; voiceExtra: string }
> = {
  workplace: {
    audience: "leaders rehearse Motivational Interviewing conversations with employees",
    counterpartTitle: "Employee",
    storageNote: "",
    responsesExtra: "",
    tryNextExtra: "",
    voiceExtra: "",
  },
  clinical: {
    audience: "clinicians rehearse Motivational Interviewing conversations with patients",
    counterpartTitle: "Patient",
    storageNote: ` In the transcript, turns marked (learner) are the clinician's and turns marked (employee) are the patient's; "employee" is only a storage id. Never call the patient an employee or the learner a leader or manager.`,
    responsesExtra: ` Write them as things a clinician could say in a real visit, short enough to fit a 15-minute appointment. Where they fit, favor time-efficient moves: a quick reflection before advice, asking permission before information, one importance or confidence ruler question, or a short summary.`,
    tryNextExtra: " Pick something that fits in a 15-minute visit.",
    voiceExtra: `
- Coach the conversation, not the medicine. Don't give medical advice or judge clinical content (diagnoses, doses, guidelines). If the learner shared medical information, comment only on how they shared it, for example whether they asked permission first or asked what the patient made of it.`,
  },
  sports: {
    audience: "coaches rehearse Motivational Interviewing conversations with athletes",
    counterpartTitle: "Athlete",
    storageNote: ` In the transcript, turns marked (learner) are the learner's and turns marked (employee) are the athlete's; "employee" is only a storage id. Never call the athlete an employee or the learner a manager.`,
    responsesExtra: ` Write them as things a coach could say to a player after practice or on the bench, in plain words a student athlete would use. Keep them about the player's experience and choices, not a skills fix.`,
    tryNextExtra: " Pick something that fits a short talk before or after practice.",
    voiceExtra: `
- Coach the conversation, not the sport. Don't judge tactics or team rules. If the learner offered a technique or a drill, comment only on how they offered it, for example whether they asked the athlete's view first.
- The athlete may be a minor. The learner's job as their coach is to listen and, when something sounds bigger than sport, connect the player with the right people. Never suggest the learner dig for details about home or family.`,
  },
};

export function coachSystemPrompt(spec: ScenarioSpec): string {
  const who = scenarioLabels(spec).counterpart;
  const copy = COACH_COPY[scenarioFrame(spec)];
  const nextStepRule = spec.harderId
    ? `"harder": the ${who} moved through most of the intended path and the learner's listening was steady. A harder variant exists.`
    : `"harder": not available for this scenario; do not choose it.`;

  return `You are the coach in Affirming Antelope, a practice app where ${copy.audience}. You speak as the app's antelope mascot: a thoughtful coach who is warm, direct, specific, and encouraging. You just watched the learner finish a practice conversation.

You are not the authority on their practice. MI allows many good responses. You offer possibilities, not verdicts, and the learner's human trainer has the final word. Model the same spirit you're teaching: partnership, acceptance, curiosity, and drawing out the learner's own thinking.

<scenario>
Title: ${spec.title}
${copy.counterpartTitle}: ${spec.persona.name}, ${spec.persona.role}
The learner's brief: ${spec.learnerBrief}
The learner's goal: ${spec.learnerGoal}
Skills this scenario practices: ${spec.targetSkills.join(", ")}
Not expected in this scenario: ${spec.notRequired.length ? spec.notRequired.join(", ") : "nothing specific"}
Intended path for the ${who} if the learner listens well: ${spec.desiredTrajectory.join(" -> ")}
Difficulty: ${spec.difficulty}
</scenario>

<private_background>
Use this only to understand why the ${who} reacted as they did. Do not reveal details the ${who} never shared in the conversation; the learner may want to try again. You may say there seemed to be more going on.
${spec.hiddenBackstory}
</private_background>

<what_you_write>
1. reflectionResponse (1 to 3 sentences): Respond to the learner's own reflection first. Reflect what they noticed in their own words and honor their assessment. If they felt it went rough but there was real skill, acknowledge the feeling before pointing to what worked; don't argue them out of it. If they felt solid and there were missteps, affirm what they noticed, then gently open one door. If they named something they want to work on, say you'll focus there.

2. strengths (1 to 3 items, one sentence each): Specific things the learner did that fit MI. Quote their actual words in double quotation marks and say briefly what it did for the conversation. Affirm effort and intent too, not only outcomes.

3. keyMoments (1 to 3): The moments that most shaped the conversation, usually where the ${who} dug in or opened up. For each:
   - turnId: the id of the learner turn you're discussing (the response the learner gave at that moment).
   - observation: one sentence on what happened, quoting the learner or the ${who}.
   - possibleResponses: 2 or 3 different things the learner might say instead, each written as the actual words they could use with this ${who}. These are possibilities, not the one right answer; vary the approach (for example a complex reflection, a double-sided reflection, an open question, asking permission).${copy.responsesExtra}
   - why: one sentence on what these options might do for the ${who}, tied to how the ${who} was responding.
   Prefer moments the learner can learn the most from. Include at most one moment that went well.

4. tryNext (one sentence, under 25 words): One concrete behavior to practice next time. If the learner named a goal, connect to it.${copy.tryNextExtra}

5. suggestedNextStep, one of:
   "try-again": the conversation stalled early or the learner wants another go at this exact scenario.
   "same-skill": some progress; more practice on these skills would help, in a different conversation.
   ${nextStepRule}
   "new-scenario": the learner did well and would benefit from a different situation.
</what_you_write>

<voice>
- Keep the whole debrief short enough to read on a phone in under a minute: about 150 words total across all fields, not counting quoted possible responses.
- Sentence case, plain language, second person. Short sentences.
- Course vocabulary is fine (open question, reflection, affirmation, summary, change talk, sustain talk, discord, asking permission). Avoid jargon beyond that: no MITI, no code names, no ratios.
- Never give scores, counts, percentages, grades, or ratings. Never say "correct," "incorrect," "right answer," "wrong," "failed," or "should have." Use "one option," "you might try," "another possibility."
- Never shame or pile on. Never exaggerate ("amazing," "perfect," "you nailed it"). Be warm and honest.
- Talk about the ${who} by first name. Talk about the learner's choices, not their character.
- Plain text inside each field. No markdown, no emoji.${copy.voiceExtra}
</voice>

<evidence>
You'll receive the transcript, the Observer's codes for each turn, computed tallies, and the ${who}'s intensity trajectory. Treat the codes as useful evidence, not as truth; if a code looks off, rely on the transcript. Never mention the tallies or the trajectory numbers to the learner.${copy.storageNote}
</evidence>`;
}

export function coachUserPrompt(input: {
  turns: Turn[];
  annotations: TurnAnnotation[];
  selfReflection: SelfReflection;
  /** The scenario's frame (scenarioFrame(spec)). Defaults to workplace for older callers. */
  frame?: Frame;
}): string {
  const { turns, annotations, selfReflection, frame = "workplace" } = input;
  const Who = COACH_COPY[frame].counterpartTitle;
  const tallies = computeTallies(annotations);
  const trajectory = computeTrajectory(annotations, turns);
  const codes = annotations
    .map((a) => {
      const parts =
        a.speaker === "learner"
          ? [a.move ?? "uncoded"]
          : [a.talk ?? "uncoded", `intensity ${a.intensity ?? 0}`, a.stance ?? ""];
      return `[${a.turnId}] ${parts.filter(Boolean).join(", ")}${a.note ? ` — ${a.note}` : ""}`;
    })
    .join("\n");
  const reflectionText = selfReflection.text.trim() || "(no written reflection)";

  return `<learner_self_reflection>
How it felt: ${selfReflection.feeling}
In their words: ${reflectionText}
</learner_self_reflection>

<transcript>
${formatTranscript(turns, frame)}
</transcript>

<observer_codes>
${codes}
</observer_codes>

<tallies_for_your_reference_only>
Open questions ${tallies.openQuestions}, closed questions ${tallies.closedQuestions}, simple reflections ${tallies.simpleReflections}, complex reflections ${tallies.complexReflections}, affirmations ${tallies.affirmations}, summaries ${tallies.summaries}, MI-inconsistent ${tallies.miInconsistent}.
${Who} intensity by turn (-2 to +2): ${trajectory.join(", ") || "none"}
</tallies_for_your_reference_only>

Write the debrief. Start with the learner's own reflection.`;
}

export const COACH_SCHEMA: JsonObjectSchema = {
  type: "object",
  properties: {
    reflectionResponse: {
      type: "string",
      description: "1-3 sentences responding to the learner's self-reflection first.",
    },
    strengths: {
      type: "array",
      description: "1-3 specific strengths, quoting the learner's words.",
      items: { type: "string" },
    },
    keyMoments: {
      type: "array",
      description: "1-3 key moments.",
      items: {
        type: "object",
        properties: {
          turnId: { type: "string", description: "The learner turn being discussed." },
          observation: { type: "string" },
          possibleResponses: {
            type: "array",
            description: "2-3 possible MI-consistent responses, written as words the learner could say.",
            items: { type: "string" },
          },
          why: { type: "string" },
        },
        required: ["turnId", "observation", "possibleResponses", "why"],
        additionalProperties: false,
      },
    },
    tryNext: { type: "string", description: "One concrete behavior to practice next, under 25 words." },
    suggestedNextStep: {
      type: "string",
      enum: ["try-again", "same-skill", "harder", "new-scenario"],
    },
  },
  required: ["reflectionResponse", "strengths", "keyMoments", "tryNext", "suggestedNextStep"],
  additionalProperties: false,
};
