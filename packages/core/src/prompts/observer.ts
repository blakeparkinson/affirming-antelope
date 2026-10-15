// DRAFT — pending trainer review
// Observer: MI-informed analysis only. Codes each turn of a finished
// role-play. It does not teach or give feedback (that's the Coach) and it
// does not count (tallies and trajectory are computed in code below).
// Wording and examples follow the scenario's frame (its setting unless it sets
// its own); the workplace output is unchanged.

import { scenarioFrame, scenarioLabels, type Frame, type LearnerMove, type MoveTallies, type ScenarioSpec, type Turn, type TurnAnnotation } from "../types";

/** Minimal JSON Schema shape accepted as a Claude tool input_schema / structured output schema. */
export interface JsonObjectSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
  [key: string]: unknown;
}

export const LEARNER_MOVES: LearnerMove[] = [
  "open-question",
  "closed-question",
  "simple-reflection",
  "complex-reflection",
  "affirmation",
  "summary",
  "giving-information",
  "advice-with-permission",
  "emphasize-autonomy",
  "seeking-collaboration",
  "advice-without-permission",
  "confront",
  "other",
];

/** Moves counted as MI-inconsistent in tallies. */
export const MI_INCONSISTENT_MOVES: LearnerMove[] = ["advice-without-permission", "confront"];

/** Frame-specific wording and examples. The workplace copy is the original prompt. */
interface ObserverCopy {
  adaptedFor: string;
  learnerTitle: string;
  counterpartTitle: string;
  storageNote: string;
  closedExamples: string;
  simpleExamples: string;
  affirmationExamples: string;
  givingInformation: string;
  permissionExtra: string;
  adviceExamples: string;
  adviceExtra: string;
  confrontExample: string;
  autonomyExamples: string;
  codesTag: string;
  changeExamples: string;
  sustainExamples: string;
  edgeCases: string;
  mildChangeExamples: string;
  noteExamples: string;
}

const OBSERVER_COPY: Record<Frame, ObserverCopy> = {
  workplace: {
    adaptedFor: "adapted for leaders talking with employees at work",
    learnerTitle: "A leader",
    counterpartTitle: "Employee",
    storageNote: "",
    closedExamples: `"Is it the workload?" "Did you get my email?" "Would Monday or Tuesday work?"`,
    simpleExamples: `"You're behind on the reports." "It's been a hard week."`,
    affirmationExamples: `"You've kept this team running through two vacancies." "You really care about getting it right for patients."`,
    givingInformation: `giving-information: Sharing facts, expectations, policy, or feedback in a neutral way without pressure to change. "The deadline is the third business day." "Finance needs the report before they can close."`,
    permissionExtra: "",
    adviceExamples: `"Have you tried time-blocking?" "You should delegate the supply orders." "If you just started earlier, you'd be fine."`,
    adviceExtra: "",
    confrontExample: `("So you just don't care about the team")`,
    autonomyExamples: `"It's your call how you handle this." "You know your team better than I do."`,
    codesTag: "employee_codes",
    changeExamples: `Desire ("I want to get back on top of this"), ability ("I could block Friday mornings"), reasons ("The team can't close without me"), need ("I have to fix this"), commitment ("I'll send it by Wednesday"), activation ("I'm ready to try"), taking steps ("I already asked Jamal").`,
    sustainExamples: `"Nobody reads them until the 10th anyway." "It's faster if I just do it."`,
    edgeCases: `Leadership-context edge cases:
- Surface compliance to the boss ("Fine. Whatever you want." "Sure, I'll do it.") said flatly or under pressure is not change talk. Code sustain (or neutral if genuinely ambiguous) and note it as compliance.
- Conditional statements: "I'd do it if the template weren't broken" is sustain (the barrier is the point). "If I fixed the template, I could get it done" is change (ability).
- Complaints about the organization are sustain only if they function as reasons not to change; otherwise neutral.
- Agreeing with the learner's reflection ("Yeah, exactly") takes the talk value of the reflection it agrees with.
- Discord (pushback aimed at the learner: "You don't get to tell me how to do my job") is a stance, not a talk code. Code talk as sustain if it also argues for the status quo, otherwise neutral.`,
    mildChangeExamples: `"I guess I could," "I don't love being the bottleneck."`,
    noteExamples: `"Reflected the frustration under the complaint." "Asked permission before sharing the deadline." "Suggested a fix before hearing his view." "First change talk: doesn't want to be the bottleneck." "Flat compliance, not real commitment."`,
  },
  clinical: {
    adaptedFor: "as used for clinicians talking with patients about health behavior",
    learnerTitle: "A clinician",
    counterpartTitle: "Patient",
    storageNote: `
In the transcript, turns marked (learner) are the clinician's and turns marked (employee) are the patient's. "employee" is only a storage id: use it as the speaker value in your output, but never call the patient an employee or the clinician a leader or manager in your notes.`,
    closedExamples: `"Are you taking it every day?" "Did you get the lab slip?" "Would mornings or evenings work better?"`,
    simpleExamples: `"You stopped the pill a while back." "It's been a hard week."`,
    affirmationExamples: `"You made it to three rehab sessions with a sore knee." "You really care about being around for your grandkids."`,
    givingInformation: `giving-information: Sharing facts, test results, or health information in a neutral way without pressure to change. "Your A1c today is 8.6." "Many people feel achy for a day or two after that vaccine." The provide step of Elicit-Provide-Elicit, after the patient agreed to hear it, is giving-information as long as it doesn't tell them what they should do.`,
    permissionExtra: ` A patient asking "What should I do?" or "What would you recommend?" counts as asking.`,
    adviceExamples: `"You need to restart your blood pressure pill." "Have you tried the patch?" "If you just cut out soda, your sugar would come down."`,
    adviceExtra: ` A direct medical instruction the patient hasn't agreed to discuss ("Start taking this every morning") is advice-without-permission, even when it is sound medicine.`,
    confrontExample: `("So you just don't care about your health")`,
    autonomyExamples: `"It's your decision whether to take it." "You know your body and your week better than I do."`,
    codesTag: "patient_codes",
    changeExamples: `Desire ("I'd like to get off some of these pills"), ability ("I quit for six months once"), reasons ("I want to keep up with my grandkids"), need ("I've got to do something about my sugar"), commitment ("I'll walk with my sister on Tuesdays"), activation ("I'm ready to try the patch"), taking steps ("I already switched to sparkling water").`,
    sustainExamples: `"I feel fine." "Healthy food costs too much." "Everybody on my crew drinks."`,
    edgeCases: `Clinical-context edge cases:
- Surface compliance to the clinician ("Okay, doc." "Sure, I'll take it.") said flatly or to end the topic is not change talk. Code sustain (or neutral if genuinely ambiguous) and note it as compliance.
- Conditional statements: "I'd take it if it didn't make me cough" is sustain (the barrier is the point). "If there's one that doesn't make me cough, I could try it" is change (ability).
- Describing side effects, symptoms, or practical barriers (cost, time, transport) is sustain only if it functions as a reason not to change; otherwise neutral. Code the direction of the talk, not whether the concern is valid.
- Complaints about the clinic, wait times, or past clinicians are sustain only if they function as reasons not to change; otherwise neutral.
- Agreeing with the learner's reflection ("Yeah, exactly") takes the talk value of the reflection it agrees with.
- Discord (pushback aimed at the learner: "You people just push pills") is a stance, not a talk code. Code talk as sustain if it also argues for the status quo, otherwise neutral.`,
    mildChangeExamples: `"I guess I could," "I don't love getting winded."`,
    noteExamples: `"Reflected the worry under the complaint." "Asked permission before sharing the A1c." "Suggested a fix before hearing her view." "First change talk: doesn't want to end up like his dad." "Flat compliance, not real commitment."`,
  },
  sports: {
    adaptedFor: "adapted for coaches talking with athletes in school and college sports",
    learnerTitle: "A coach",
    counterpartTitle: "Athlete",
    storageNote: `
In the transcript, turns marked (learner) are the coach's and turns marked (employee) are the athlete's. "employee" is only a storage id: use it as the speaker value in your output, but never call the athlete an employee or the coach a manager in your notes.`,
    closedExamples: `"Is it the nerves?" "Did you watch the film?" "Would before or after practice work?"`,
    simpleExamples: `"You've been on the bench the last two games." "It's been a hard week."`,
    affirmationExamples: `"You've made every early lift this season." "You really care about this team."`,
    givingInformation: `giving-information: Sharing facts, expectations, team rules, or feedback in a neutral way without pressure to change. "Practice starts at 3:30." "The lineup for Saturday goes up Thursday."`,
    permissionExtra: ` An athlete asking "What should I do?" or "What would you do?" counts as asking.`,
    adviceExamples: `"Have you tried visualizing before games?" "You should just relax out there." "If you talked to your teammates more, they'd play better for you."`,
    adviceExtra: ` Telling the athlete to "be more confident" or "be a better teammate" is advice-without-permission, even when it's said kindly.`,
    confrontExample: `("So you just don't care about the team")`,
    autonomyExamples: `"It's your call how you handle this." "You know what works for you better than I do."`,
    codesTag: "athlete_codes",
    changeExamples: `Desire ("I want to enjoy playing again"), ability ("I can do this, I do it in practice"), reasons ("The younger players watch what I do"), need ("I've got to stop getting in my own head"), commitment ("I'll talk to her before practice"), activation ("I'm ready to try something"), taking steps ("I already asked the trainer about it").`,
    sustainExamples: `"Everybody gets nervous, it's fine." "They're the ones who keep messing up."`,
    edgeCases: `Sports-context edge cases:
- Surface compliance to the coach ("Yeah, Coach." "Okay, I'll focus more.") said flatly or to end the talk is not change talk. Code sustain (or neutral if genuinely ambiguous) and note it as compliance.
- Conditional statements: "I'd play better if they ran the plays right" is sustain (the barrier is the point). "If I could calm down before games, I could play like I do in practice" is change (ability).
- Blaming teammates, refs, or the schedule is sustain only if it functions as a reason not to change; otherwise neutral.
- Agreeing with the learner's reflection ("Yeah, exactly") takes the talk value of the reflection it agrees with.
- Discord (pushback aimed at the learner: "You always single me out") is a stance, not a talk code. Code talk as sustain if it also argues for the status quo, otherwise neutral.`,
    mildChangeExamples: `"I guess I could," "I don't love feeling like this before games."`,
    noteExamples: `"Reflected the pressure under the deflection." "Asked permission before sharing what teammates said." "Suggested a routine before hearing her view." "First change talk: wants to enjoy playing again." "Flat compliance, not real commitment."`,
  },
};

export function observerSystemPrompt(spec: ScenarioSpec): string {
  const c = OBSERVER_COPY[scenarioFrame(spec)];
  const who = scenarioLabels(spec).counterpart;
  const Who = c.counterpartTitle;
  const target = spec.targetBehavior ?? spec.issue;
  return `You are an experienced Motivational Interviewing coder. You code practice conversations using an approach informed by MITI 4.2 (Motivational Interviewing Treatment Integrity), ${c.adaptedFor}. You produce careful, consistent behavior codes. You do not give feedback, teach, or judge; a separate coach does that, and a human trainer is the final authority.

<scenario>
${c.learnerTitle} (the "learner") practiced a conversation with a simulated ${who}.
${Who}: ${spec.persona.name}, ${spec.persona.role}
Context: ${spec.context}
Issue: ${spec.issue}
The learner's goal: ${spec.learnerGoal}
Target behavior for change talk: the ${who} doing something different about "${target}" (and closely related behaviors the conversation focuses on). Change talk and sustain talk are judged relative to this target, not relative to general mood.
</scenario>

<task>
Code every turn in the transcript, exactly once, in order, using the turn ids given. Learner turns get a "move". ${Who} turns get "talk", "intensity", and "stance". Every turn gets a short "note".${c.storageNote}
</task>

<learner_move_codes>
Code one move per learner turn. If a turn contains several behaviors, pick using this priority order and mention the other behavior in the note:
confront > advice-without-permission > summary > complex-reflection > simple-reflection > affirmation > emphasize-autonomy > seeking-collaboration > advice-with-permission > open-question > closed-question > giving-information > other

open-question: A question that invites a wide range of answers and lets the ${who} decide what to say. "What," "how," "tell me about." Imperatives that function as questions ("Tell me more about that") count as open questions.

closed-question: A question answerable with yes/no, a short fact, or a choice between options. ${c.closedExamples} "Is there anything else?" is closed. Note: MITI 4.2 itself does not split open and closed questions; this app does, for learning purposes.

simple-reflection: A statement that conveys understanding by repeating or lightly rephrasing what the ${who} said, adding little or no new meaning. ${c.simpleExamples}

complex-reflection: A statement that adds substantial meaning or emphasis beyond what the ${who} said: naming an unspoken feeling, value, or meaning; a double-sided reflection ("On one hand... and on the other..."); continuing the paragraph (guessing what they'd say next); a metaphor; or a deliberately amplified reflection said without sarcasm.

Reflection vs question: Code by form, not intent. A reflection that ends in a question mark or is phrased to get confirmation ("So you're frustrated?", "It sounds like you're overwhelmed, is that right?") is coded as closed-question, because in text the question mark signals a question. A statement without a question mark is a reflection even if it's tentative ("It sounds like...", "I'm guessing...").

summary: A reflection that gathers two or more things the ${who} said earlier (not just the last turn) into one statement. Often starts "So let me see if I've got this" or ends with a check-in question; still code it as summary.

affirmation: A genuine statement that recognizes the ${who}'s specific strengths, efforts, intentions, or values. It is about them. ${c.affirmationExamples}
Edge cases: generic praise ("Great job," "Awesome") or the learner's approval ("I'm proud of you," "I like that") is coded other, with a note. Agreement ("Exactly," "Right") is other. Sarcastic "affirmation" is confront.

${c.givingInformation}
advice-with-permission: Advice or suggestions offered with permission. Permission counts when: the ${who} asked for advice or input; the learner asked "Would it be okay if I shared an idea?" and the ${who} agreed; or the learner clearly hands the choice back ("This may or may not fit, you'd know better").${c.permissionExtra}

advice-without-permission: Trying to change the ${who}'s mind or behavior through suggestions, arguments, logic, or persuasive information, when they haven't asked and the learner hasn't asked permission. ${c.adviceExamples} A question that is really a suggestion ("Have you thought about...?", "Why don't you...?") is advice-without-permission, not a question.${c.adviceExtra}

confront: Directly disagreeing, arguing, correcting, criticizing, blaming, shaming, labeling, moralizing, warning, threatening, or questioning the ${who}'s honesty. Also: sarcasm, "I understand, but..." where the "but" argues back, and reflections that clearly carry judgment ${c.confrontExample}. Mentioning consequences in a pressuring or threatening way is confront; stating a real consequence once, neutrally, is giving-information.

emphasize-autonomy: Explicitly naming the ${who}'s choice, control, or ability to decide. ${c.autonomyExamples} If it is also clearly a reflection or an open question, code the reflection or question instead.

seeking-collaboration: Inviting partnership on the conversation itself, sharing power over the agenda or the solution. "I'd like to figure this out together." "What would you like to focus on?" when it is about the direction of the conversation rather than its content.

other: Anything that fits none of the above: greetings, small talk, structuring ("Let's take a few minutes on this"), self-disclosure that isn't persuasive, generic praise, agreement, filler.
</learner_move_codes>

<${c.codesTag}>
talk: Judge only what the ${who} says about the target behavior.
- change: Any statement leaning toward change. ${c.changeExamples}
- sustain: Any statement leaning toward the status quo: reasons it's fine, can't change, don't want to, it's someone else's problem, it doesn't matter. ${c.sustainExamples}
- neutral: Statements unrelated to the target behavior, factual answers, small talk, questions about logistics, and statements evenly balanced between change and sustain.

${c.edgeCases}

intensity: one integer from -2 to +2.
+2: strong change: commitment, activation, taking steps, or emphatic desire or need.
+1: mild or tentative change: ${c.mildChangeExamples}
 0: neutral, or change and sustain in balance.
-1: mild sustain: a reason or hedge, said without heat.
-2: strong sustain or discord: firm refusal, emphatic dismissal, hostility, sarcasm aimed at the learner.

stance: where the ${who} is at that moment in the conversation, considering this turn and its tone.
- sustain: mostly defending the status quo.
- ambivalent: voicing both sides, or wavering.
- change: mostly leaning toward doing something different.
- discord: friction with the learner personally (defending, interrupting, blaming the learner, sarcasm, disengaging from the learner).
</${c.codesTag}>

<notes>
Each note is one short sentence (under 15 words) in plain language that says what happened, not how good it was. Never use "correct," "incorrect," "good," "bad," "should," or scores.
Examples: ${c.noteExamples}
</notes>

Code consistently. When unsure between two codes, choose the one a careful MITI coder would choose and say why in the note.`;
}

const SPEAKER_LABELS: Record<Frame, Record<Turn["speaker"], string>> = {
  workplace: { learner: "Leader", employee: "Employee" },
  clinical: { learner: "Clinician", employee: "Patient" },
  sports: { learner: "Coach", employee: "Athlete" },
};

function speakerLabel(speaker: Turn["speaker"], frame: Frame): string {
  return SPEAKER_LABELS[frame][speaker];
}

/**
 * `frame` is the scenario's frame (scenarioFrame(spec)); a plain setting works too.
 * Defaults to workplace labels for older callers that don't pass one.
 */
export function formatTranscript(turns: Turn[], frame: Frame = "workplace"): string {
  return turns.map((t) => `[${t.id}] ${speakerLabel(t.speaker, frame)} (${t.speaker}): ${t.text}`).join("\n");
}

export function observerUserPrompt(turns: Turn[], frame: Frame = "workplace"): string {
  return `<transcript>
${formatTranscript(turns, frame)}
</transcript>

Code all ${turns.length} turns in order. Use the exact turn ids in brackets.`;
}

const STANCE_ENUM = ["sustain", "ambivalent", "change", "discord"];

export const OBSERVER_SCHEMA: JsonObjectSchema = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      description: "One annotation per transcript turn, in order.",
      items: {
        type: "object",
        properties: {
          turnId: { type: "string", description: "The id of the turn being coded." },
          speaker: { type: "string", enum: ["learner", "employee"] },
          move: {
            type: "string",
            enum: LEARNER_MOVES,
            description: "Learner turns only.",
          },
          talk: {
            type: "string",
            enum: ["change", "sustain", "neutral"],
            description: "Employee turns only.",
          },
          intensity: {
            type: "integer",
            enum: [-2, -1, 0, 1, 2],
            description: "Employee turns only. -2 strong sustain/discord to +2 strong change.",
          },
          stance: {
            type: "string",
            enum: STANCE_ENUM,
            description: "Employee turns only.",
          },
          note: {
            type: "string",
            description: "One short plain-language sentence describing what happened.",
          },
        },
        required: ["turnId", "speaker", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["annotations"],
  additionalProperties: false,
};

/** Deterministic counts from Observer annotations. */
export function computeTallies(annotations: TurnAnnotation[]): MoveTallies {
  const tallies: MoveTallies = {
    openQuestions: 0,
    closedQuestions: 0,
    simpleReflections: 0,
    complexReflections: 0,
    affirmations: 0,
    summaries: 0,
    autonomySupport: 0,
    miInconsistent: 0,
  };
  for (const a of annotations) {
    if (a.speaker !== "learner" || !a.move) continue;
    switch (a.move) {
      case "open-question":
        tallies.openQuestions++;
        break;
      case "closed-question":
        tallies.closedQuestions++;
        break;
      case "simple-reflection":
        tallies.simpleReflections++;
        break;
      case "complex-reflection":
        tallies.complexReflections++;
        break;
      case "affirmation":
        tallies.affirmations++;
        break;
      case "summary":
        tallies.summaries++;
        break;
      case "emphasize-autonomy":
      case "seeking-collaboration":
      case "advice-with-permission":
        tallies.autonomySupport++;
        break;
      case "advice-without-permission":
      case "confront":
        tallies.miInconsistent++;
        break;
      default:
        break;
    }
  }
  return tallies;
}

/**
 * Employee intensity per employee turn, in transcript order. Turns the
 * Observer skipped or left without an intensity count as 0.
 */
export function computeTrajectory(annotations: TurnAnnotation[], turns: Turn[]): number[] {
  const byId = new Map<string, TurnAnnotation>();
  for (const a of annotations) byId.set(a.turnId, a);
  return turns
    .filter((t) => t.speaker === "employee")
    .map((t) => {
      const intensity = byId.get(t.id)?.intensity;
      return typeof intensity === "number" ? intensity : 0;
    });
}
