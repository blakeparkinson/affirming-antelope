import { getScenario, scenarioFrame, type LearnerMove, type Stance } from "@antelope/core";
import { ApiError, errorResponse, optionsResponse, readJson, streamResponse, requireAi } from "@/lib/ai/http";
import { authenticate, chargeQuota } from "@/lib/ai/auth";
import { classifyMove, mockEmployeeReply, mockStream } from "@/lib/ai/mock";
import { streamEmployeeReply } from "@/lib/ai/roleplay";
import { parseScenarioId, parseTurns } from "@/lib/ai/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

/**
 * POST /api/roleplay/turn -> text/plain stream of the employee's reply, with the
 * stance it was played in as `X-Stance` and the learner's last move as the
 * role-player read it as `X-Move` (each absent when the role-player didn't say).
 */
export async function POST(req: Request) {
  try {
    const caller = await authenticate(req);
    const mode = requireAi();

    const { id, obj } = parseScenarioId(await readJson(req));
    const spec = getScenario(id);
    if (!spec) throw new ApiError(404, `Unknown scenario "${id}".`);
    const turns = parseTurns(obj.turns, { lastMustBeLearner: true });
    const quota = await chargeQuota(caller, "turn");

    if (mode === "mock") {
      const reply = mockEmployeeReply(turns, scenarioFrame(spec));
      const move = classifyMove(turns[turns.length - 1].text);
      return streamResponse(req, mockStream(reply.text, req.signal), { ...quota, ...readHeaders(reply.stance, move) });
    }
    const { stance, move, body } = await streamEmployeeReply(spec, turns, req.signal);
    return streamResponse(req, body, { ...quota, ...readHeaders(stance, move) });
  } catch (err) {
    return errorResponse(req, err);
  }
}

function readHeaders(stance?: Stance, move?: LearnerMove): Record<string, string> {
  return { ...(stance ? { "X-Stance": stance } : {}), ...(move ? { "X-Move": move } : {}) };
}
