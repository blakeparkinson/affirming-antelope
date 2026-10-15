// Deterministic mock AI used when AI_MOCK=1 (or no key in development), so the
// app UI can be built without spending tokens. Not smart: it uses keyword
// heuristics so good vs. poor learner turns produce visibly different output.

import {
  computeTallies,
  computeTrajectory,
  type Debrief,
  type Drill,
  type DrillFeedback,
  type LearnerMove,
  type NextStep,
  type Stance,
  scenarioFrame,
  type Frame,
  type ScenarioSpec,
  type SelfReflection,
  type Turn,
  type TurnAnnotation,
} from "@antelope/core";
import { cleanAnnotations } from "./pipeline";
import { sleep } from "./http";

// ---------------------------------------------------------------------------
// Heuristic move classifier
// ---------------------------------------------------------------------------

export function classifyMove(text: string): LearnerMove {
  const t = text.trim().toLowerCase();
  if (!t) return "other";
  const asks = t.includes("?");
  if (/\b(you should|you need to|you have to|you must|you can't|you cannot|i need you to|this has to|why didn't you|why haven't you)\b/.test(t)) {
    return /\b(or else|consequences|last chance|write you up|final warning)\b/.test(t) ? "confront" : "advice-without-permission";
  }
  if (/\b(it'?s up to you|your call|your choice|you decide|what works for you)\b/.test(t)) return "emphasize-autonomy";
  if (/\b(would it be ok|would it be okay|is it ok if|may i (share|suggest)|can i (share|offer|suggest)|want to hear)\b/.test(t)) {
    return "advice-with-permission";
  }
  if (/\b(together|work (this|it) out with|figure (this|it) out)\b/.test(t)) return "seeking-collaboration";
  if (/\b(so far|let me pull|to sum up|let me summari[sz]e|here'?s what i('ve| have) heard)\b/.test(t)) return "summary";
  if (/\b(i appreciate|i admire|i respect|you'?ve clearly|it takes (a lot|guts|courage)|thank you for)\b/.test(t)) {
    return "affirmation";
  }
  if (/\b(sounds like|seems like|it seems|you'?re feeling|you feel|you'?re worried|you'?re frustrated|part of you|on one hand|on the other hand)\b/.test(t) && !asks) {
    return t.split(/\s+/).length >= 14 || /\b(because|but also|while|and yet|part of you)\b/.test(t)
      ? "complex-reflection"
      : "simple-reflection";
  }
  if (asks) {
    return /^(what|how|tell me|help me|where|when|who|in what way)\b/.test(t) || /\b(what|how)\b/.test(t.slice(0, 40))
      ? "open-question"
      : "closed-question";
  }
  if (/^(you|it) (are|is|were|was|feel|seem)/.test(t)) return "simple-reflection";
  return "giving-information";
}

/** How much a learner move builds (+) or erodes (-) rapport. */
const MOVE_WEIGHT: Record<LearnerMove, number> = {
  "complex-reflection": 2,
  "simple-reflection": 1,
  "open-question": 1,
  affirmation: 1,
  summary: 1,
  "emphasize-autonomy": 1,
  "seeking-collaboration": 1,
  "advice-with-permission": 0,
  "giving-information": 0,
  other: 0,
  "closed-question": -0.5,
  "advice-without-permission": -1.5,
  confront: -2.5,
};

function rapportAfter(turns: Turn[]): { rapport: number; lastMove: LearnerMove } {
  let rapport = 0;
  let lastMove: LearnerMove = "other";
  for (const t of turns) {
    if (t.speaker !== "learner") continue;
    lastMove = classifyMove(t.text);
    rapport = Math.max(-4, Math.min(8, rapport + MOVE_WEIGHT[lastMove]));
  }
  return { rapport, lastMove };
}

// ---------------------------------------------------------------------------
// Role-player mock
// ---------------------------------------------------------------------------

const ENTRENCH = [
  "Okay, but that's easy to say. You're not the one dealing with it every day.",
  "Honestly? I feel like I'm being lectured. I know what's expected.",
  "*sighs* Right. So this is just going to be a list of what I'm doing wrong.",
  "I get it, I get it. Can we just move on?",
];
const GUARDED = [
  "I mean... it's fine. I'm handling it.",
  "Yeah, I guess. There's just a lot going on right now.",
  "I'm not sure what you want me to say.",
  "It's not really a big deal. Things come up.",
];
const OPENING = [
  "It's been harder than I let on, to be honest. I didn't really want to bring it up.",
  "Yeah... part of me knows it's not working. I just don't know what else to do.",
  "I think I've been so busy trying to keep up that I stopped asking for help.",
];
const SOFTENED = [
  "Honestly, I'd like to get this right. I just haven't known where to start.",
  "Maybe if I had a clearer picture of what matters most, I could plan around it.",
  "I think I could try something different. I'd want to run it by you first, though.",
];

// Patient-style replies for clinical scenarios.
const CLINICAL_REPLIES = {
  entrench: [
    "I know, I know. Everybody tells me the same thing. It's easy to say when it isn't your life.",
    "Honestly? I feel like I'm being lectured. I came in for something else.",
    "*sighs* Right. So this is just another list of what I'm doing wrong.",
    "I hear you, doc. Can we just move on? I've got somewhere to be.",
  ],
  guarded: [
    "I mean... it's fine. I'm handling it.",
    "Yeah, I guess. There's just a lot going on right now.",
    "I'm not sure what you want me to say.",
    "It's not really a big deal. I feel okay most days.",
  ],
  opening: [
    "It's been harder than I let on, to be honest. I didn't really want to bring it up.",
    "Yeah... part of me knows it's not working. I just don't know what else to try.",
    "I think I've been so busy that I stopped paying attention to it. It does worry me.",
  ],
  softened: [
    "Honestly, I'd like to get this right. I just haven't known where to start.",
    "Maybe if I could start with one small thing, I could make it work around my week.",
    "I think I could try something different. I'd want to see how it goes first, though.",
  ],
};

// Athlete-style replies for sports scenarios (a coach and a student athlete).
const SPORTS_REPLIES = {
  entrench: [
    "Okay, but you're not the one out there. It's easy to say from the sideline.",
    "Honestly? I feel like I'm getting lectured. I know what I'm supposed to do.",
    "Right. So this is just going to be a list of what I'm doing wrong.",
    "I get it, Coach. Can we just go to practice?",
  ],
  guarded: [
    "I mean... it's fine. I'm handling it.",
    "Yeah, I guess. There's just a lot going on right now.",
    "I don't know what you want me to say, Coach.",
    "It's not a big deal. Everybody has off games.",
  ],
  opening: [
    "It's been harder than I let on, to be honest. I didn't really want to bring it up.",
    "Yeah... part of me knows it's not working. I just don't know what else to do.",
    "I think I've been so worried about messing up that I stopped enjoying it.",
  ],
  softened: [
    "Honestly, I want it to feel good again. I just don't know where to start.",
    "Maybe if I tried one small thing before the next game, I could see if it helps.",
    "I think I could try something different. I'd want to see how it goes first, though.",
  ],
};

const REPLIES: Record<Frame, typeof SPORTS_REPLIES> = {
  workplace: { entrench: ENTRENCH, guarded: GUARDED, opening: OPENING, softened: SOFTENED },
  clinical: CLINICAL_REPLIES,
  sports: SPORTS_REPLIES,
};

/** `frame` is the scenario's frame (scenarioFrame(spec)). The stance is what the line would be played in. */
export function mockEmployeeReply(turns: Turn[], frame: Frame = "workplace"): { text: string; stance: Stance } {
  const { rapport, lastMove } = rapportAfter(turns);
  const n = turns.filter((t) => t.speaker === "learner").length;
  const pick = (arr: string[]) => arr[(n - 1 + arr.length) % arr.length];
  const replies = REPLIES[frame];
  if (lastMove === "confront" || lastMove === "advice-without-permission" || rapport < -1) {
    return { text: pick(replies.entrench), stance: "discord" };
  }
  if (rapport < 2) return { text: pick(replies.guarded), stance: rapport < 0 ? "sustain" : "ambivalent" };
  if (rapport < 4.5) return { text: pick(replies.opening), stance: "ambivalent" };
  return { text: pick(replies.softened), stance: "change" };
}

/** Streams text in small chunks with small delays, like a real token stream. */
export function mockStream(text: string, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,4}/g) ?? [];
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      await sleep(350, signal); // time-to-first-token
      for (const chunk of chunks) {
        if (signal?.aborted) break;
        controller.enqueue(encoder.encode(chunk));
        await sleep(30, signal);
      }
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Debrief mock
// ---------------------------------------------------------------------------

export async function mockDebrief(
  spec: ScenarioSpec,
  turns: Turn[],
  selfReflection: SelfReflection,
): Promise<Debrief> {
  await sleep(1200);
  const name = spec.persona.name.split(" ")[0];
  const frame = scenarioFrame(spec);

  const raw: TurnAnnotation[] = [];
  let rapport = 0;
  for (const t of turns) {
    if (t.speaker === "learner") {
      const move = classifyMove(t.text);
      rapport = Math.max(-4, Math.min(8, rapport + MOVE_WEIGHT[move]));
      raw.push({ turnId: t.id, speaker: "learner", move, note: moveNote(move) });
    } else {
      const intensity = (rapport <= -2 ? -2 : rapport < 0 ? -1 : rapport < 2 ? 0 : rapport < 4.5 ? 1 : 2) as -2 | -1 | 0 | 1 | 2;
      const stance = intensity <= -2 ? "discord" : intensity < 0 ? "sustain" : intensity === 0 ? "ambivalent" : "change";
      raw.push({
        turnId: t.id,
        speaker: "employee",
        talk: intensity > 0 ? "change" : intensity < 0 ? "sustain" : "neutral",
        intensity,
        stance,
        note:
          intensity > 0
            ? `${name} voices a reason to change.`
            : intensity < 0
              ? `${name} argues for keeping things as they are.`
              : `${name} is guarded and noncommittal.`,
      });
    }
  }
  const annotations = cleanAnnotations(raw, turns);
  const tallies = computeTallies(annotations);
  const trajectory = computeTrajectory(annotations, turns);

  const learnerAnn = annotations.filter((a) => a.speaker === "learner");
  const turnById = new Map(turns.map((t) => [t.id, t]));
  const best = learnerAnn.reduce<TurnAnnotation | undefined>(
    (b, a) => (!b || MOVE_WEIGHT[a.move ?? "other"] > MOVE_WEIGHT[b.move ?? "other"] ? a : b),
    undefined,
  );
  const weakest = learnerAnn.reduce<TurnAnnotation | undefined>(
    (w, a) => (!w || MOVE_WEIGHT[a.move ?? "other"] < MOVE_WEIGHT[w.move ?? "other"] ? a : w),
    undefined,
  );
  const quote = (id?: string) => {
    const text = id ? (turnById.get(id)?.text ?? "") : "";
    return text.length > 90 ? `${text.slice(0, 87).trimEnd()}...` : text;
  };

  const strengths: string[] = [];
  if (best && MOVE_WEIGHT[best.move ?? "other"] > 0) {
    strengths.push(`"${quote(best.turnId)}" kept ${name} talking about what they actually care about.`);
  }
  if (tallies.openQuestions > 0) strengths.push(`You asked ${tallies.openQuestions} open question${tallies.openQuestions > 1 ? "s" : ""} that invited ${name} to explain in their own words.`);
  if (strengths.length === 0) strengths.push(`You stayed in the conversation with ${name} and kept it respectful.`);

  const keyMoments: Debrief["keyMoments"] = [];
  if (weakest && MOVE_WEIGHT[weakest.move ?? "other"] < 1) {
    keyMoments.push({
      turnId: weakest.turnId,
      observation: `"${quote(weakest.turnId)}" moved toward ${weakest.move === "closed-question" ? "a yes/no answer" : "fixing or persuading"}, and ${name} pulled back a little.`,
      possibleResponses: {
        clinical: [
          `It sounds like there's a lot going on in your life, and part of you isn't sure this is the right time to talk about it.`,
          `What's been getting in the way, from where you sit?`,
          `You want to feel well, and something about how this is working right now makes that hard.`,
        ],
        workplace: [
          `It sounds like there's a lot on your plate, and part of you isn't sure this is the right time to talk about it.`,
          `What's been getting in the way, from where you sit?`,
          `You want to do good work here, and something about how things are set up is making that hard.`,
        ],
        sports: [
          `It sounds like a lot is riding on this for you, and part of you isn't sure this is the right time to talk about it.`,
          `What's been getting in the way, from where you sit?`,
          `You care about this team, and something about how this season is going is making that hard.`,
        ],
      }[frame],
      why: "A reflection or open question keeps the person doing the thinking, which is where their own reasons for change come from.",
    });
  }

  if (keyMoments.length === 0 && best) {
    keyMoments.push({
      turnId: best.turnId,
      observation: `"${quote(best.turnId)}" worked. Here is how you could build on it next time.`,
      possibleResponses: frame === "clinical"
        ? [
            `So it's been a real struggle, and you still care how this turns out. What would "better" look like for you?`,
            `You've been managing a lot of this on your own. What part of it matters most to you?`,
          ]
        : [
            `So the pressure is real, and you still care how this turns out. What would "better" look like for you?`,
            `You've been carrying a lot of this on your own. What part of it matters most to you?`,
          ],
      why: "Following a good reflection with a question about what they want keeps the momentum with their own reasons.",
    });
  }

  const net = trajectory.length ? trajectory[trajectory.length - 1] - trajectory[0] : 0;
  const suggestedNextStep: NextStep = net >= 2 ? "harder" : net >= 0 ? "same-skill" : "try-again";
  const reflectionResponse =
    selfReflection.feeling === "rough"
      ? `You called this one rough, and that honesty is useful. There were some real moments to build on, so let's look at them.`
      : selfReflection.feeling === "solid"
        ? `You felt good about this one, and some of it earned that. Let's look at what worked and one spot to sharpen.`
        : `Mixed feels right. Parts of this worked and parts pulled ${name} away, which is normal for this skill.`;

  return {
    reflectionResponse,
    strengths: strengths.slice(0, 3),
    keyMoments,
    tryNext: "Before asking another question, reflect back the feeling underneath what they just said.",
    suggestedNextStep,
    annotations,
    tallies,
    trajectory,
  };
}

function moveNote(move: LearnerMove): string {
  const notes: Record<LearnerMove, string> = {
    "open-question": "Open question that invites a longer answer.",
    "closed-question": "Closed question; invites a short yes/no answer.",
    "simple-reflection": "Reflected back what was said.",
    "complex-reflection": "Reflected the meaning or feeling underneath the words.",
    affirmation: "Named a specific strength or effort.",
    summary: "Gathered several pieces into a summary.",
    "giving-information": "Offered information.",
    "advice-with-permission": "Asked before offering a suggestion.",
    "emphasize-autonomy": "Handed the choice back to them.",
    "seeking-collaboration": "Invited working on it together.",
    "advice-without-permission": "Told them what to do without asking first.",
    confront: "Confronted or warned.",
    other: "Did not clearly fit a code.",
  };
  return notes[move];
}

// ---------------------------------------------------------------------------
// Drill feedback mock
// ---------------------------------------------------------------------------

const INSTRUCTION_TARGETS: [RegExp, LearnerMove[]][] = [
  [/complex reflection|double-sided/i, ["complex-reflection"]],
  [/simple reflection/i, ["simple-reflection", "complex-reflection"]],
  [/open question/i, ["open-question"]],
  [/affirmation/i, ["affirmation"]],
  [/summary/i, ["summary"]],
  [/autonomy/i, ["emphasize-autonomy", "complex-reflection", "simple-reflection"]],
  [/reflection/i, ["simple-reflection", "complex-reflection"]],
];

export async function mockDrillFeedback(drill: Drill, response: string): Promise<DrillFeedback> {
  await sleep(600);

  if (drill.choices) {
    const chosen = drill.choices.find((c) => c.text === response.trim());
    const target = drill.choices.find((c) => c.isTarget);
    return {
      move: "other",
      hitTarget: chosen?.isTarget ?? false,
      observation: chosen?.explanation ?? "That option was not one of the choices shown.",
      possibleResponses: target ? [target.text] : [],
      tryNext: "Say why the option you picked fits before moving to the next drill.",
    };
  }

  const move = classifyMove(response);
  const wanted = INSTRUCTION_TARGETS.find(([re]) => re.test(drill.instruction))?.[1];
  const hitTarget = wanted ? wanted.includes(move) : MOVE_WEIGHT[move] > 0;
  const examples = drill.exampleResponses.slice(0, 3);
  return {
    move,
    hitTarget,
    observation: hitTarget
      ? `This reads as ${move.replace(/-/g, " ")}, which is what the drill asked for.`
      : `This reads as ${move.replace(/-/g, " ")}. The drill asked for something a little different: ${drill.instruction}`,
    ...(hitTarget ? { strength: "You stayed with what they said instead of jumping to a fix." } : {}),
    possibleResponses: examples,
    tryNext: hitTarget
      ? "Try the same move again, aiming at the feeling underneath their words."
      : "Start by naming the feeling you hear, then stop. Let them respond.",
  };
}
