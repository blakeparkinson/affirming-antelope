/**
 * API error bodies: `{ error, code?, reason?, retry_after?, ... }` (docs/anonymous-auth.md).
 * Its own module, free of React Native imports, so plain Node tests can build one.
 */
export class ApiError extends Error {
  status: number;
  /** e.g. `quota_exceeded`, `ai_resting`, `auth_required`, `invalid_token`. */
  code?: string;
  /** For `quota_exceeded`: `daily` or `burst`. */
  reason?: string;
  /** Seconds until trying again makes sense. */
  retryAfter?: number;
  constructor(status: number, message: string, body?: { code?: unknown; reason?: unknown; retry_after?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (typeof body?.code === 'string') this.code = body.code;
    if (typeof body?.reason === 'string') this.reason = body.reason;
    if (typeof body?.retry_after === 'number') this.retryAfter = body.retry_after;
  }
}
