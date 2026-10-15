import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { aiMode } from "./client";
import { ProviderError } from "./providers/types";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: Record<string, string>,
    /** Extra JSON fields next to `error`, e.g. `{ code: "quota_exceeded", retry_after: 30 }`. */
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Maps anything thrown while handling a request to a safe {status, message}. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return new ApiError(499, "Request cancelled.");
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ApiError(504, "The AI took too long to respond. Please try again.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ApiError(502, "Could not reach the AI service. Please try again.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ApiError(503, "The AI service is busy right now. Please try again in a moment.", { "Retry-After": "10" });
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("[ai] Anthropic auth failure (check ANTHROPIC_API_KEY).");
    return new ApiError(502, "The AI service is misconfigured.");
  }
  if (err instanceof Anthropic.APIError) {
    // Log status + message server-side only; never forward upstream bodies.
    console.error(`[ai] Anthropic API error ${err.status ?? "?"}: ${err.message}`);
    return new ApiError(502, "The AI service returned an error. Please try again.");
  }
  if (err instanceof OpenAI.APIUserAbortError) return new ApiError(499, "Request cancelled.");
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new ApiError(504, "The AI took too long to respond. Please try again.");
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new ApiError(502, "Could not reach the AI service. Please try again.");
  }
  // Mid-stream errors arrive as a status-less APIError carrying the error code.
  if (err instanceof OpenAI.RateLimitError || (err instanceof OpenAI.APIError && err.code === "rate_limit_exceeded")) {
    // 429 covers rate limits and an empty balance (code credit_balance_exhausted); the log says which.
    console.error(`[ai] OpenAI rate limit ${err.code ?? ""}: ${err.message}`);
    return new ApiError(503, "The AI service is busy right now. Please try again in a moment.", { "Retry-After": "10" });
  }
  if (err instanceof OpenAI.AuthenticationError || err instanceof OpenAI.PermissionDeniedError) {
    console.error("[ai] OpenAI auth failure (check OPENAI_API_KEY).");
    return new ApiError(502, "The AI service is misconfigured.");
  }
  if (err instanceof OpenAI.APIError) {
    console.error(`[ai] OpenAI API error ${err.status ?? "?"}: ${err.message}`);
    return new ApiError(502, "The AI service returned an error. Please try again.");
  }
  if (err instanceof ProviderError) {
    console.error(`[ai] ${err.message}`);
    return new ApiError(502, "The AI service returned an error. Please try again.");
  }
  console.error("[ai] Unexpected error:", err instanceof Error ? err.message : "unknown");
  return new ApiError(500, "Something went wrong.");
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // TODO(2026-10-25): drop x-antelope-key with the legacy app token path (auth.ts).
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-antelope-key",
    "Access-Control-Expose-Headers": "Retry-After, X-Quota-Limit, X-Quota-Remaining, X-Stance, X-Move",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (!origin) return base; // native app: no CORS involved

  if (process.env.NODE_ENV !== "production") {
    // Dev: Expo web (localhost:8081), LAN IPs, tunnels. Reflect whatever asks.
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  const allowed = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return allowed.includes(origin) ? { ...base, "Access-Control-Allow-Origin": origin } : base;
}

export function optionsResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function jsonResponse(req: Request, body: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
      ...extra,
    },
  });
}

export function errorResponse(req: Request, err: unknown): Response {
  const e = toApiError(err);
  return jsonResponse(req, { error: e.message, ...e.body }, e.status, e.headers);
}

export function streamResponse(req: Request, body: ReadableStream<Uint8Array>, extra?: Record<string, string>): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      ...corsHeaders(req),
      ...extra,
    },
  });
}

// ---------------------------------------------------------------------------
// Abuse guards. The real limits are durable and per user (consume_ai_quota, see
// ./auth.ts). What's here: the legacy shared app token check and an in-memory
// limiter used only in local dev without Supabase.
// ---------------------------------------------------------------------------

/**
 * True when the request carries `x-antelope-key` matching APP_CLIENT_TOKEN
 * (constant-time). False when APP_CLIENT_TOKEN is unset: with no token configured
 * there is no legacy path at all.
 *
 * TODO(2026-10-25): remove with the legacy app token path (auth.ts).
 */
export function appTokenMatches(req: Request): boolean {
  const expected = process.env.APP_CLIENT_TOKEN;
  if (!expected) return false;
  const given = req.headers.get("x-antelope-key") ?? "";
  // Hash both sides so lengths match and timingSafeEqual never throws.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The client IP. On Vercel these headers are set by the platform (a client can't
 * spoof them); elsewhere they are only as trustworthy as the proxy in front.
 */
export function clientIp(req: Request): string {
  const fwd = (h: string) => req.headers.get(h)?.split(",")[0]?.trim();
  return fwd("x-vercel-forwarded-for") || fwd("x-real-ip") || fwd("x-forwarded-for") || "local";
}

/** Keyed hash of the client IP, so raw IPs are never stored. */
export function clientIpHash(req: Request): string {
  const pepper = process.env.APP_CLIENT_TOKEN || "antelope";
  return createHmac("sha256", pepper).update(clientIp(req)).digest("hex");
}

// In-memory sliding window. Per serverless instance, so not a real limit: used only
// for local dev without Supabase configured (Caller kind "dev").
const hits = new Map<string, number[]>();
let lastSweep = 0;

export function rateLimitKey(key: string, max: number, windowMs = 60_000): void {
  const now = Date.now();
  if (now - lastSweep > windowMs * 5) {
    lastSweep = now;
    for (const [k, v] of hits) if (v.every((t) => now - t > 10 * 60_000)) hits.delete(k);
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    const retry = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    hits.set(key, recent);
    throw new ApiError(
      429,
      "Too many requests. Please slow down and try again shortly.",
      { "Retry-After": String(retry) },
      { code: "quota_exceeded", reason: "burst", retry_after: retry },
    );
  }
  recent.push(now);
  hits.set(key, recent);
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 128 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "Request body is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

/** Throws 503 when production has no key; returns the mode otherwise. */
export function requireAi(): "live" | "mock" {
  const mode = aiMode();
  if (mode === "unavailable") throw new ApiError(503, "The AI service is not configured.");
  return mode;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
