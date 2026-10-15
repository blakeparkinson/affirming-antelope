import { isLearnerMove, isStance, type SelfReflection, type Turn } from "@antelope/core";
import { ApiError } from "./http";

export const MAX_TURNS = 40;
export const MAX_TURN_CHARS = 1500;
export const MAX_REFLECTION_CHARS = 2000;
export const MAX_DRILL_RESPONSE_CHARS = 1500;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseScenarioId(body: unknown): { id: string; obj: Record<string, unknown> } {
  if (!isObject(body)) throw new ApiError(400, "Request body must be a JSON object.");
  const id = body.scenarioId;
  if (typeof id !== "string" || !id.trim() || id.length > 64) throw new ApiError(400, "scenarioId is required.");
  return { id: id.trim(), obj: body };
}

export function parseTurns(raw: unknown, opts: { lastMustBeLearner: boolean }): Turn[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ApiError(400, "turns must be a non-empty array.");
  if (raw.length > MAX_TURNS) throw new ApiError(400, `Transcript is too long (max ${MAX_TURNS} turns).`);

  const seen = new Set<string>();
  const turns: Turn[] = raw.map((t, i) => {
    if (!isObject(t)) throw new ApiError(400, `turns[${i}] must be an object.`);
    const { id, speaker, text } = t;
    if (typeof id !== "string" || !id || id.length > 64) throw new ApiError(400, `turns[${i}].id is required.`);
    if (seen.has(id)) throw new ApiError(400, `Duplicate turn id "${id}".`);
    seen.add(id);
    if (speaker !== "learner" && speaker !== "employee") {
      throw new ApiError(400, `turns[${i}].speaker must be "learner" or "employee".`);
    }
    if (typeof text !== "string" || !text.trim()) throw new ApiError(400, `turns[${i}].text is required.`);
    if (text.length > MAX_TURN_CHARS) {
      throw new ApiError(400, `turns[${i}].text is too long (max ${MAX_TURN_CHARS} characters).`);
    }
    // the stance a counterpart line was played in and the move a learner line was read as,
    // so the role-player keeps its tags (warmth.ts)
    if (speaker === "employee" && isStance(t.stance)) return { id, speaker, text: text.trim(), stance: t.stance };
    if (speaker === "learner" && isLearnerMove(t.move)) return { id, speaker, text: text.trim(), move: t.move };
    return { id, speaker, text: text.trim() };
  });

  if (!turns.some((t) => t.speaker === "learner")) throw new ApiError(400, "turns must include a learner turn.");
  if (opts.lastMustBeLearner && turns[turns.length - 1].speaker !== "learner") {
    throw new ApiError(400, "The last turn must be from the learner.");
  }
  return turns;
}

export function parseSelfReflection(raw: unknown): SelfReflection {
  if (!isObject(raw)) throw new ApiError(400, "selfReflection is required.");
  const { feeling, text } = raw;
  if (feeling !== "rough" && feeling !== "mixed" && feeling !== "solid") {
    throw new ApiError(400, 'selfReflection.feeling must be "rough", "mixed" or "solid".');
  }
  if (text !== undefined && typeof text !== "string") throw new ApiError(400, "selfReflection.text must be a string.");
  const t = (text ?? "").trim();
  if (t.length > MAX_REFLECTION_CHARS) {
    throw new ApiError(400, `selfReflection.text is too long (max ${MAX_REFLECTION_CHARS} characters).`);
  }
  return { feeling, text: t };
}

export function parseDrillRequest(body: unknown): { drillId: string; response: string } {
  if (!isObject(body)) throw new ApiError(400, "Request body must be a JSON object.");
  const { drillId, response } = body;
  if (typeof drillId !== "string" || !drillId.trim() || drillId.length > 64) {
    throw new ApiError(400, "drillId is required.");
  }
  if (typeof response !== "string") throw new ApiError(400, "response must be a string.");
  if (response.length > MAX_DRILL_RESPONSE_CHARS) {
    throw new ApiError(400, `response is too long (max ${MAX_DRILL_RESPONSE_CHARS} characters).`);
  }
  return { drillId: drillId.trim(), response: response.trim() };
}
