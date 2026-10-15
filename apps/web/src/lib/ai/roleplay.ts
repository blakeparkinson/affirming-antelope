import { parseStanceTag, rolePlayerMessages, rolePlayerSystemPrompt, type ScenarioSpec, type Stance, type Turn } from "@antelope/core";
import { ApiError } from "./http";
import { logUsage, resolveRole } from "./providers";

const TURN_TIMEOUT_MS = 45_000;
const encoder = new TextEncoder();

/**
 * Streams the employee's next line as UTF-8 text deltas, with the stance it was
 * played in.
 *
 * The reply opens with a private stance tag ("[change] ..."). It is read off
 * before returning and never streamed, so the learner only ever gets the words;
 * the stance goes back as a header. Waiting for it also means failures that
 * happen before any output (bad key, rate limit, refusal, timeout) can still
 * become a clean JSON error with a real status code instead of a broken 200 stream.
 */
export async function streamEmployeeReply(
  spec: ScenarioSpec,
  turns: Turn[],
  signal: AbortSignal,
): Promise<{ stance?: Stance; body: ReadableStream<Uint8Array> }> {
  const { provider, model } = resolveRole("rolePlayer");
  const started = Date.now();
  const log = async (label: string, ttfbMs?: number) =>
    logUsage({
      provider: provider.id,
      model,
      role: "rolePlayer",
      label,
      ms: Date.now() - started,
      ttfbMs,
      usage: await stream.usage(),
    });

  const stream = provider.streamText({
    role: "rolePlayer",
    model,
    maxTokens: 400, // replies are 1-4 sentences
    system: rolePlayerSystemPrompt(spec),
    messages: rolePlayerMessages(turns),
    timeoutMs: TURN_TIMEOUT_MS,
    signal,
    cacheKey: `rolePlayer:${spec.id}`,
  });

  const iterator = stream[Symbol.asyncIterator]();
  // read until the tag is settled and there are words to send
  let head = "";
  let ended = false;
  let tag = parseStanceTag(head);
  while (!tag.done || !tag.text) {
    const next = await iterator.next();
    if (next.done) {
      ended = true;
      tag = parseStanceTag(head, true);
      break;
    }
    head += next.value;
    tag = parseStanceTag(head);
  }
  const first = tag.done ? tag.text : "";
  if (!first.trim()) {
    await log("roleplay.turn(empty)");
    throw new ApiError(502, "The AI did not produce a reply. Please try again.");
  }
  const ttfbMs = Date.now() - started;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(first));
        if (ended) {
          await log("roleplay.turn", ttfbMs);
          return controller.close();
        }
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
        await log("roleplay.turn", ttfbMs);
        controller.close();
      } catch (err) {
        // Headers are already sent; the best we can do is end the stream.
        if (!signal.aborted) console.error("[ai] roleplay.turn stream failed mid-reply:", errName(err));
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return { stance: tag.done ? tag.stance : undefined, body };
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown";
}
