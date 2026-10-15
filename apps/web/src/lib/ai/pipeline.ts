import {
  COACH_SCHEMA,
  DRILL_FEEDBACK_SCHEMA,
  LEARNER_MOVES,
  OBSERVER_SCHEMA,
  coachSystemPrompt,
  coachUserPrompt,
  computeTallies,
  computeTrajectory,
  drillCoachSystemPrompt,
  drillCoachUserPrompt,
  observerSystemPrompt,
  observerUserPrompt,
  scenarioFrame,
  type ClientTalk,
  type Debrief,
  type Drill,
  type DrillFeedback,
  type KeyMoment,
  type LearnerMove,
  type NextStep,
  type ScenarioSpec,
  type SelfReflection,
  type Stance,
  type Turn,
  type TurnAnnotation,
} from "@antelope/core";
import { ApiError } from "./http";
import { structuredCall } from "./structured";

const STANCES: Stance[] = ["sustain", "ambivalent", "change", "discord"];
const TALKS: ClientTalk[] = ["change", "sustain", "neutral"];
const NEXT_STEPS: NextStep[] = ["try-again", "same-skill", "harder", "new-scenario"];
const INTENSITIES = [-2, -1, 0, 1, 2] as const;

export async function runDebrief(
  spec: ScenarioSpec,
  turns: Turn[],
  selfReflection: SelfReflection,
  signal?: AbortSignal,
): Promise<Debrief> {
  // 1. Observer: code every turn.
  const observed = await structuredCall<{ annotations?: unknown }>({
    role: "observer",
    label: "debrief.observer",
    system: observerSystemPrompt(spec),
    user: observerUserPrompt(turns, scenarioFrame(spec)),
    schema: OBSERVER_SCHEMA,
    schemaName: "observer",
    cacheScope: spec.id,
    maxTokens: 8000,
    timeoutMs: 75_000,
    signal,
  });
  const annotations = cleanAnnotations(observed.annotations, turns);
  if (annotations.length === 0) throw new ApiError(502, "The AI analysis came back empty. Please try again.");

  // 2. Coach: teach from the (validated) codes. Counts are ours, not the model's.
  const coached = await structuredCall<Record<string, unknown>>({
    role: "coach",
    label: "debrief.coach",
    system: coachSystemPrompt(spec),
    user: coachUserPrompt({ turns, annotations, selfReflection, frame: scenarioFrame(spec) }),
    schema: COACH_SCHEMA,
    schemaName: "coach",
    cacheScope: spec.id,
    maxTokens: 6000,
    timeoutMs: 75_000,
    signal,
  });
  const coach = cleanCoach(coached, turns);

  return {
    ...coach,
    annotations,
    tallies: computeTallies(annotations),
    trajectory: computeTrajectory(annotations, turns),
  };
}

export async function runDrillFeedback(drill: Drill, response: string, signal?: AbortSignal): Promise<DrillFeedback> {
  const raw = await structuredCall<Record<string, unknown>>({
    role: "drillCoach",
    label: "drill.feedback",
    system: drillCoachSystemPrompt(drill.setting),
    user: drillCoachUserPrompt(drill, response),
    schema: DRILL_FEEDBACK_SCHEMA,
    schemaName: "drill_feedback",
    cacheScope: drill.setting,
    maxTokens: 2500,
    timeoutMs: 40_000,
    signal,
  });
  const move: LearnerMove = LEARNER_MOVES.includes(raw.move as LearnerMove) ? (raw.move as LearnerMove) : "other";
  const strength = str(raw.strength);
  return {
    move,
    hitTarget: raw.hitTarget === true,
    observation: str(raw.observation),
    ...(strength ? { strength } : {}),
    possibleResponses: strArr(raw.possibleResponses).slice(0, 3),
    tryNext: str(raw.tryNext),
  };
}

// ---------------------------------------------------------------------------
// Validation of model output. The schema guarantees shape; these checks guard
// semantics the schema cannot express (ids exist, speakers match, no dupes).
// ---------------------------------------------------------------------------

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
}

export function cleanAnnotations(raw: unknown, turns: Turn[]): TurnAnnotation[] {
  if (!Array.isArray(raw)) return [];
  const speakerById = new Map(turns.map((t) => [t.id, t.speaker]));
  const byId = new Map<string, TurnAnnotation>();

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as Record<string, unknown>;
    const turnId = typeof a.turnId === "string" ? a.turnId : "";
    const speaker = speakerById.get(turnId);
    if (!speaker || byId.has(turnId)) continue; // unknown id or duplicate

    // Trust the transcript for speaker, then keep only fields valid for it.
    const clean: TurnAnnotation = { turnId, speaker };
    if (speaker === "learner") {
      clean.move = LEARNER_MOVES.includes(a.move as LearnerMove) ? (a.move as LearnerMove) : "other";
    } else {
      if (TALKS.includes(a.talk as ClientTalk)) clean.talk = a.talk as ClientTalk;
      if (INTENSITIES.includes(a.intensity as (typeof INTENSITIES)[number])) {
        clean.intensity = a.intensity as TurnAnnotation["intensity"];
      }
      if (STANCES.includes(a.stance as Stance)) clean.stance = a.stance as Stance;
    }
    const note = str(a.note);
    if (note) clean.note = note;
    byId.set(turnId, clean);
  }

  // Transcript order, whatever order the model used.
  return turns.flatMap((t) => {
    const a = byId.get(t.id);
    return a ? [a] : [];
  });
}

type CoachFields = Omit<Debrief, "annotations" | "tallies" | "trajectory">;

export function cleanCoach(raw: Record<string, unknown>, turns: Turn[]): CoachFields {
  const learnerIds = new Set(turns.filter((t) => t.speaker === "learner").map((t) => t.id));

  const keyMoments: KeyMoment[] = [];
  if (Array.isArray(raw.keyMoments)) {
    for (const m of raw.keyMoments) {
      if (typeof m !== "object" || m === null) continue;
      const k = m as Record<string, unknown>;
      const turnId = typeof k.turnId === "string" ? k.turnId : "";
      if (!learnerIds.has(turnId)) continue; // must point at a real learner turn
      const possibleResponses = strArr(k.possibleResponses).slice(0, 3);
      if (!str(k.observation) || possibleResponses.length === 0) continue;
      keyMoments.push({ turnId, observation: str(k.observation), possibleResponses, why: str(k.why) });
    }
  }

  const reflectionResponse = str(raw.reflectionResponse);
  const tryNext = str(raw.tryNext);
  if (!reflectionResponse || !tryNext) throw new ApiError(502, "The AI returned an incomplete debrief. Please try again.");

  return {
    reflectionResponse,
    strengths: strArr(raw.strengths).slice(0, 3),
    keyMoments: keyMoments.slice(0, 3),
    tryNext,
    suggestedNextStep: NEXT_STEPS.includes(raw.suggestedNextStep as NextStep)
      ? (raw.suggestedNextStep as NextStep)
      : "same-skill",
  };
}
