import OpenAI, { toFile } from "openai";
import { VOICE_MODELS, scenarioFrame, type Frame, type ScenarioSpec } from "@antelope/core";
import { ApiError, toApiError } from "./http";
import type { Caller } from "./auth";

/**
 * Shared pieces of the voice routes (docs/voice.md): mode, limits, error mapping,
 * the transcription prompt, container sniffing and the mock audio.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_MS = 60_000;
export const MAX_SPEAK_CHARS = 600;
/** A multipart envelope (boundary, field headers, small fields) on top of the audio itself. */
const MULTIPART_OVERHEAD = 16 * 1024;
export const MAX_UPLOAD_BYTES = MAX_AUDIO_BYTES + MULTIPART_OVERHEAD;

// ---------------------------------------------------------------------------
// Mode and models
// ---------------------------------------------------------------------------

export type VoiceMode = "live" | "mock";

let loggedMode: string | null = null;

/**
 * live: OpenAI calls. mock: AI_MOCK=1, or no OPENAI_API_KEY outside production.
 * Production with no key throws 503 voice_unavailable (the client falls back to Type).
 * Voice only needs the OpenAI key, whichever provider runs the role-player.
 */
export function voiceMode(): VoiceMode {
  const flag = process.env.AI_MOCK?.trim().toLowerCase();
  const forcedMock = flag === "1" || flag === "true";
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const isProd = process.env.NODE_ENV === "production";
  const mode = forcedMock ? "mock" : hasKey ? "live" : isProd ? "unavailable" : "mock";

  if (loggedMode !== mode) {
    loggedMode = mode;
    if (mode === "mock") console.log("[voice] MOCK MODE active. Scripted transcripts and silent audio; no OpenAI calls.");
    if (mode === "unavailable") console.error("[voice] OPENAI_API_KEY is not set in production; voice routes will return 503.");
  }
  if (mode === "unavailable") throw voiceUnavailable();
  return mode;
}

export function voiceModels(): { transcription: string; tts: string } {
  return {
    transcription: process.env.AI_VOICE_STT_MODEL?.trim() || VOICE_MODELS.transcription,
    tts: process.env.AI_VOICE_TTS_MODEL?.trim() || VOICE_MODELS.tts,
  };
}

let client: OpenAI | null = null;
export function voiceClient(): OpenAI {
  // One retry, like the text provider. Retries only cover failures before any bytes stream.
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 30_000 });
  return client;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** 503 `{error:"voice_unavailable"}`: the client switches to Type. */
export function voiceUnavailable(): ApiError {
  return new ApiError(503, "voice_unavailable", { "Retry-After": "60" }, { code: "voice_unavailable" });
}

/** Voice needs a Supabase user (the legacy shared-token tier has no voice quota). */
export function requireUserCaller(caller: Caller): void {
  if (caller.kind === "legacy") {
    throw new ApiError(401, "Sign in to use voice practice.", undefined, { code: "auth_required" });
  }
}

/**
 * Maps a provider failure to an ApiError. An empty balance / insufficient quota, and a
 * rejected key, become 503 voice_unavailable with the reason logged server-side (never
 * the request content). Everything else goes through the shared mapper.
 */
export function toVoiceError(err: unknown, label: "stt" | "tts"): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof OpenAI.APIError) {
    const code = String(err.code ?? "");
    const quotaCode = code === "insufficient_quota" || code === "credit_balance_exhausted" || code === "billing_hard_limit_reached";
    const quotaText = /insufficient[_ ]quota|exceeded your current quota|credit balance|billing/i.test(err.message ?? "");
    if (err.status === 402 || (err.status === 429 && (quotaCode || quotaText)) || quotaCode) {
      console.error(`[voice] ${label} unavailable: OpenAI quota or credits exhausted (status ${err.status ?? "?"} ${code}).`);
      return voiceUnavailable();
    }
    if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) {
      console.error(`[voice] ${label} unavailable: OpenAI rejected the key (status ${err.status ?? "?"}); check OPENAI_API_KEY.`);
      return voiceUnavailable();
    }
    if (err.status === 400 || err.status === 415) {
      console.error(`[voice] ${label} OpenAI rejected the request (status ${err.status}): ${err.message}`);
      if (label === "stt") {
        return new ApiError(415, "That audio format could not be read. Try again or type instead.", undefined, {
          code: "unsupported_audio",
        });
      }
    }
  }
  return toApiError(err);
}

/** One line per voice call: ids, sizes and timings only. Never audio or text. */
export function logVoiceUsage(fields: Record<string, string | number | undefined>): void {
  if (process.env.AI_LOG_USAGE === "0") return;
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  console.log(`[voice] usage ${parts.join(" ")}`);
}

// ---------------------------------------------------------------------------
// Upload: bounded read and container detection
// ---------------------------------------------------------------------------

/** Reads a request body, refusing (413) as soon as it passes `max` bytes instead of buffering it all. */
export async function readBodyCapped(req: Request, max: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > max) throw new ApiError(413, "audio_too_large", undefined, { code: "audio_too_large" });
  if (!req.body) throw new ApiError(400, "Request body must be multipart/form-data.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void reader.cancel().catch(() => {});
      throw new ApiError(413, "audio_too_large", undefined, { code: "audio_too_large" });
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export type AudioKind = { ext: "webm" | "mp4" | "m4a" | "wav"; mime: string };

function ascii(b: Uint8Array, from: number, len: number): string {
  return String.fromCharCode(...b.subarray(from, from + len));
}

/**
 * Detects webm, mp4/m4a or wav from the file's first bytes. Browsers and Expo label
 * recordings inconsistently (video/webm, audio/x-m4a, application/octet-stream), and
 * OpenAI identifies the container from the bytes and the filename extension, so the real
 * container is what we trust, not the declared type. Null = unsupported (415).
 */
export function detectAudio(bytes: Uint8Array): AudioKind | null {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return { ext: "wav", mime: "audio/wav" };
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { ext: "webm", mime: "audio/webm" };
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    return brand === "M4A " || brand === "M4B "
      ? { ext: "m4a", mime: "audio/mp4" }
      : { ext: "mp4", mime: "audio/mp4" };
  }
  return null;
}

/** Duration of a PCM wav from its header, or null. Lets the server check a wav's claimed length. */
export function wavDurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 12;
  let byteRate = 0;
  while (pos + 8 <= bytes.length) {
    const id = ascii(bytes, pos, 4);
    const size = v.getUint32(pos + 4, true);
    if (id === "fmt " && pos + 20 <= bytes.length) byteRate = v.getUint32(pos + 16, true);
    if (id === "data") {
      if (!byteRate) return null;
      // A streamed wav may carry 0 or 0xFFFFFFFF for the size: use what's there.
      const len = size === 0 || size === 0xffffffff || pos + 8 + size > bytes.length ? bytes.length - pos - 8 : size;
      return Math.round((len / byteRate) * 1000);
    }
    pos += 8 + size + (size % 2);
  }
  return null;
}

export { toFile };

// ---------------------------------------------------------------------------
// Transcription prompt
// ---------------------------------------------------------------------------

const DOMAIN_TERMS: Record<Frame, string[]> = {
  workplace: ["one-on-one", "performance review", "deadline", "workload", "reflective listening"],
  clinical: ["A1c", "statin", "blood pressure", "medication", "refill", "reflective listening"],
  sports: ["practice", "game", "playing time", "teammates", "Coach", "reflective listening"],
};

/** The persona's full and first name: the proper nouns a learner is most likely to say. */
function properNouns(spec: ScenarioSpec): string[] {
  const first = spec.persona.name.split(/\s+/)[0];
  return [...new Set([spec.persona.name, first])];
}

/** Context for the transcription model: names and topic words, never the hidden backstory. */
export function transcriptionHints(spec: ScenarioSpec): { prompt: string; keywords: string[] } {
  const terms = DOMAIN_TERMS[scenarioFrame(spec)];
  const prompt =
    `A practice conversation with ${spec.persona.name}, ${spec.persona.role}. ` +
    `Context: ${spec.context}. Topic: ${spec.issue}. ` +
    `Likely words: ${terms.join(", ")}.`;
  return { prompt, keywords: [...properNouns(spec), ...terms].slice(0, 12) };
}

/** True when the transcript has nothing intelligible (empty, punctuation only, a lone letter). */
export function isNoSpeech(text: string): boolean {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length < 2;
}

// ---------------------------------------------------------------------------
// Mock mode
// ---------------------------------------------------------------------------

const MOCK_LINES = [
  "Yeah, I hear that.",
  "It sounds like the reports keep changing on you, and that's frustrating.",
  "I can see why that feels like a moving target. What would help most right now?",
  "So part of you wants to keep things the way they are, and part of you is wondering if something has to change. Is that fair?",
  "Thank you for telling me that. It sounds like you've been carrying a lot, and I'd like to understand more about what the last few weeks have been like for you and what matters most.",
];

/** A scripted learner line: short audio gets a short line, a long take a long one. */
export function mockTranscript(durationMs: number): string {
  const i = Math.min(MOCK_LINES.length - 1, Math.floor(Math.max(0, durationMs) / 4000));
  return MOCK_LINES[i];
}

// One silent MPEG-1 Layer III frame: 32 kbps, 32 kHz, mono, 144 bytes, 36 ms. The header
// is followed by zeros (empty side info and main data), which decoders play as silence.
const FRAME_BYTES = 144;
const FRAME_MS = 36;
const SILENT_FRAME = (() => {
  const f = new Uint8Array(FRAME_BYTES);
  f.set([0xff, 0xfb, 0x18, 0xc0]);
  return f;
})();

/** Silent MP3 whose length scales with the text (about 15 characters per second, 0.6 to 25 s). */
export function mockMp3(text: string): Uint8Array {
  const ms = Math.min(25_000, Math.max(600, Math.round((text.length / 15) * 1000)));
  const frames = Math.ceil(ms / FRAME_MS);
  const out = new Uint8Array(frames * FRAME_BYTES);
  for (let i = 0; i < frames; i++) out.set(SILENT_FRAME, i * FRAME_BYTES);
  return out;
}

/** The bytes as a stream in small chunks, so mock mode exercises the client's streaming path. */
export function chunkedStream(bytes: Uint8Array, chunk = 2048, delayMs = 20, signal?: AbortSignal): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal?.aborted || at >= bytes.length) return controller.close();
      if (at > 0 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      controller.enqueue(bytes.subarray(at, at + chunk));
      at += chunk;
    },
  });
}
