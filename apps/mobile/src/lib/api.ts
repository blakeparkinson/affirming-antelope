import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { AiEndpoint } from '@antelope/core';
import { track } from './analytics';
import { ApiError } from './apiError';
import { tokenAfter401 } from './authRetry';
import { sessionWithin } from '@/sync/anonymous';
import { currentSession, setCurrentSession, supabase } from './supabase';

const DEV_API_PORT = 3000;

/**
 * Base URL of the Next.js API (apps/web).
 *
 * 1. `EXPO_PUBLIC_API_URL` if set (use this for deployed builds).
 * 2. Otherwise the dev machine's LAN host, taken from the Expo dev server's
 *    `hostUri` (e.g. "192.168.1.5:8081"), on port 3000. This is what makes a
 *    phone running Expo Go reach `next dev` on the laptop.
 * 3. Otherwise http://localhost:3000.
 */
function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEV_API_PORT}`;

  return `http://localhost:${DEV_API_PORT}`;
}

/**
 * Headers sent on every API call: `Authorization: Bearer <Supabase access token>`.
 * Every learner has one: guests are anonymous Supabase users (docs/anonymous-auth.md),
 * created on first launch, or here if that hasn't happened yet (offline launch).
 * supabase-js keeps the token fresh while the app is open.
 */
async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const access = (await sessionWithin(4000))?.access_token;
  if (access) headers.Authorization = `Bearer ${access}`;
  return headers;
}

/**
 * After a 401: refresh once; a guest whose session is gone (or who never got one) gets a
 * fresh anonymous session instead (docs/anonymous-auth.md, "Error codes"). Null: don't retry.
 */
async function retryHeaders(): Promise<Record<string, string> | null> {
  const token = await tokenAfter401({
    current: currentSession,
    refresh: async () => {
      const { data, error } = await supabase.auth.refreshSession().catch((e: unknown) => ({ data: { session: null }, error: e }));
      return { session: data.session, rejected: !data.session && !!error && !isAuthRetryableFetchError(error) };
    },
    freshGuest: async () => {
      // the dead guest session goes first (the auth listener keeps its practice for the next guest)
      if (currentSession()) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      setCurrentSession(null);
      return sessionWithin(4000);
    },
  });
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : null;
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

export { ApiError } from './apiError';

/** Which AI endpoint a path is, for `ai_request_failed`. Other paths aren't AI calls. */
function aiEndpoint(path: string): AiEndpoint | null {
  if (path.startsWith('/api/drill')) return 'drill';
  if (path.startsWith('/api/roleplay/turn')) return 'turn';
  if (path.startsWith('/api/roleplay/debrief')) return 'debrief';
  return null;
}

/** Status code only (0 = never got a response). Never the request, the response body or the error text. */
function reportFailure(path: string, status: number) {
  const endpoint = aiEndpoint(path);
  if (endpoint) track('ai_request_failed', { endpoint, status });
}

/** A request that threw before any response (offline, DNS, timeout). Caller-initiated aborts aren't failures. */
function reportThrown(path: string, e: unknown) {
  if ((e as { name?: string } | null)?.name === 'AbortError') return;
  reportFailure(path, 0);
}

async function failure(res: { status: number; text(): Promise<string> }, path?: string): Promise<ApiError> {
  if (path) reportFailure(path, res.status);
  const text = await res.text().catch(() => '');
  let body: { error?: unknown; code?: unknown; reason?: unknown; retry_after?: unknown } | undefined;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  const message = typeof body?.error === 'string' ? body.error : text || `Request failed with status ${res.status}`;
  return new ApiError(res.status, message, body);
}

/** POST with the bearer token; on a 401, renew the session once (`retryHeaders`) and try again. */
async function send(doFetch: typeof fetch, path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return sendRaw(doFetch, path, JSON.stringify(body), true, signal);
}

/** `send` for any body. JSON bodies get the JSON content type; multipart sets its own boundary. */
async function sendRaw(doFetch: typeof fetch, path: string, body: BodyInit, json: boolean, signal?: AbortSignal): Promise<Response> {
  const init = (headers: Record<string, string>) => {
    if (!json) delete headers['Content-Type'];
    return { method: 'POST', headers, body, signal };
  };
  let res: Response;
  try {
    res = await doFetch(apiUrl(path), init(await apiHeaders()));
    if (res.status === 401) {
      const retry = await retryHeaders();
      if (retry) res = await doFetch(apiUrl(path), init(retry));
    }
  } catch (e) {
    reportThrown(path, e);
    throw e;
  }
  return res;
}

export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await send(fetch, path, body, signal);
  if (!res.ok) throw await failure(res, path);
  return (await res.json()) as T;
}

/**
 * POST `multipart/form-data` (voice turns: the recorded audio plus ids) and read JSON back.
 * Uses the platform `fetch`: React Native's understands `{ uri, name, type }` file parts.
 */
export async function postForm<T>(path: string, form: FormData, signal?: AbortSignal): Promise<T> {
  const res = await sendRaw(fetch, path, form, false, signal);
  if (!res.ok) throw await failure(res, path);
  return (await res.json()) as T;
}

/**
 * POST JSON and return the successful response itself, for binary bodies (spoken replies,
 * `audio/mpeg`). Native uses `expo/fetch`, whose responses support `arrayBuffer()`.
 */
export async function postForResponse(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const doFetch = Platform.OS === 'web' ? fetch : ((expoFetch as unknown as typeof fetch) ?? fetch);
  const res = await send(doFetch, path, body, signal);
  if (!res.ok) throw await failure(res, path);
  return res;
}

/**
 * POST and stream the text response, calling `onChunk` with each decoded
 * piece as it arrives. Resolves with the full text.
 *
 * Streaming notes: React Native's built-in `fetch` does not expose
 * `response.body` as a ReadableStream. This uses `expo/fetch` (WinterCG fetch
 * with streaming, available in Expo Go on SDK 52+) on native, and the browser
 * `fetch` on web. If a stream still isn't available, it falls back to reading
 * the whole body and calls `onChunk` once with the full text. `onHeaders`
 * gets the successful response's headers before the first chunk.
 */
export async function postStream(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  onHeaders?: (headers: Headers) => void,
): Promise<string> {
  const doFetch = (expoFetch as unknown as typeof fetch) ?? fetch;
  const res = await send(doFetch, path, body, signal);
  if (!res.ok) throw await failure(res, path);
  onHeaders?.(res.headers);

  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    if (text) onChunk(text);
    return text;
  }

  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    if (piece) {
      full += piece;
      onChunk(piece);
    }
  }
  const rest = decoder.decode();
  if (rest) {
    full += rest;
    onChunk(rest);
  }
  return full;
}

/**
 * POST /api/account/merge-anonymous: move a guest's practice into the account the
 * learner just signed in to (docs/anonymous-auth.md). `accountToken` is the account's
 * access token, `guestToken` the guest's, kept from before the switch.
 */
export async function mergeAnonymous(
  accountToken: string,
  guestToken: string,
): Promise<{ merged: true; learnerState: string; completionsMoved: number; sessionsMoved: number }> {
  const res = await fetch(apiUrl('/api/account/merge-anonymous'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ anonymousAccessToken: guestToken }),
  });
  if (!res.ok) throw await failure(res);
  return res.json();
}
