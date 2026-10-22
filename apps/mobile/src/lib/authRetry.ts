/** Just what the 401 recovery reads from a Supabase session. */
export interface SessionLike {
  access_token: string;
  user: { id: string; is_anonymous?: boolean };
}

export interface AuthRecovery {
  /** The session the failed request was sent with (null: it went without one). */
  current(): SessionLike | null;
  /**
   * `supabase.auth.refreshSession()`: the renewed session, or why not. `rejected` is true when
   * the auth server turned the refresh token down, false when it couldn't be reached.
   */
  refresh(): Promise<{ session: SessionLike | null; rejected: boolean }>;
  /**
   * Drop the dead session (`dead`, null when there was none) and start a new anonymous one;
   * null when that fails too. If another session has taken its place meanwhile, use that one.
   */
  freshGuest(dead: SessionLike | null): Promise<SessionLike | null>;
}

/**
 * The token to retry a 401 with, or null to give up. One retry at most, chosen like this:
 *
 * 1. A refresh that works wins (`invalid_token`: the token had gone stale).
 * 2. An account is never swapped for a guest here: signing an account out resets the
 *    device, which is the auth listener's call (engine.ts), not a request's.
 * 3. A guest whose refresh couldn't reach the auth server is kept: replacing a session that
 *    may still be good would orphan the guest.
 * 4. Otherwise the guest's session is dead (refresh token turned down: the guest was deleted
 *    or signed out elsewhere) or there never was one (`auth_required`): start a fresh
 *    anonymous one. Local practice carries over to it (engine.ts, `signedOut`).
 */
export async function tokenAfter401(r: AuthRecovery): Promise<string | null> {
  // read before refreshing: a failed refresh clears it
  const before = r.current();
  const { session, rejected } = await r.refresh();
  if (session) return session.access_token;
  if (before && !before.user.is_anonymous) return null;
  if (before && !rejected) return null;
  return (await r.freshGuest(before))?.access_token ?? null;
}
