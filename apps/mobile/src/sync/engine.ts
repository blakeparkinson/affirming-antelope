import type { AuthChangeEvent, RealtimeChannel, Session } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { identifyUser, resetAnalytics, setPerson, track } from '@/lib/analytics';
import { ApiError, mergeAnonymous } from '@/lib/api';
import { uuid } from '@/lib/uuid';
import { isTransient, onSimulatedOfflineChange, setCurrentSession, supabase, supabaseConfigured } from '@/lib/supabase';
import { useAccount, type Submission } from '@/state/account';
import { hadLearnerData, setRecordOwner, SYNCED_KEYS, useLearner, type PracticeSession } from '@/state/store';
import { ensureSession, retryAnonymousNow } from './anonymous';
import { refreshCloud } from './cloud';
import { adoptOnSignIn, applyingRemote, pullState, pushState } from './learnerState';
import { backoff, completionOp, flushOps, resetBackoff, sessionOp, useOutbox, type Op } from './outbox';

/**
 * The sync engine. Starts once at launch (`startSync`) and then:
 *
 *   auth      Guests are anonymous Supabase users (docs/anonymous-auth.md): with no
 *             session at launch, one is created quietly (retried while offline).
 *             Anonymous session → owner for new records, one-time upload of practice
 *             done without a session, learner_state sync; no identify, no cloud data.
 *             Anonymous → permanent on the same uid (email verified) → `converted`.
 *             Permanent session → owner, guest merge (merge-anonymous) or upload,
 *             learner_state adopt-or-merge, flush, refresh. SIGNED_OUT of an account →
 *             `resetDevice`: everything of theirs is wiped from the device, then a clean
 *             guest starts (the account's practice lives on the server, so signing back
 *             in restores it). A guest that merely loses its session keeps its practice.
 *   practice  a new completion or session in the learner store → outbox op.
 *             A change to the synced part of the state → learner_state marked dirty.
 *   flush     on enqueue (debounced), foreground, reconnect, sign-in and a backoff
 *             timer. Outbox ops first (in order), then learner_state.
 *   refresh   cloud data on sign-in, foreground (throttled), reconnect, pull-to-refresh,
 *             after a flush that changed progress, and on Realtime review events.
 *
 * Guest mode and offline are the normal case: nothing here blocks the UI.
 */

let started = false;
let user: { id: string; email: string; anonymous: boolean } | null = null;
let flushing: Promise<void> | null = null;
let again = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let stateAttempts = 0;
let lastRefresh = 0;
let channel: RealtimeChannel | null = null;
/** A permanent account has been on this device since the last wipe. */
let accountLive = false;
let wiping: Promise<void> | null = null;

export function currentUserId(): string | undefined {
  return user?.id;
}

/** Signed in to a real account (not a guest). Cohorts, reviews and submissions need this. */
function permanent(): boolean {
  return !!user && !user.anonymous;
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

function scheduleRetry(at: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(
    () => {
      retryTimer = null;
      void flush();
    },
    Math.max(250, at - Date.now()),
  );
}

/** Send everything waiting for the signed-in user. Coalesces concurrent calls. */
export function flush(): Promise<void> {
  if (!user) return Promise.resolve();
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = (async () => {
    do {
      again = false;
      const u = user;
      if (!u) break;
      const before = useOutbox
        .getState()
        .entries.filter((e) => e.userId === u.id)
        .map((e) => e.op.type);
      const res = await flushOps(u.id);
      let retryAt = res.retryAt;
      if (useOutbox.getState().stateDirty[u.id] && retryAt === null) {
        useOutbox.getState().markStateDirty(u.id, false);
        try {
          await pushState(u.id);
          stateAttempts = 0;
        } catch {
          useOutbox.getState().markStateDirty(u.id, true);
          useOutbox.setState({ stalled: true });
          stateAttempts += 1;
          retryAt = Date.now() + backoff(stateAttempts);
        }
      }
      if (retryAt === null) useOutbox.setState({ stalled: false });
      if (retryAt !== null) scheduleRetry(retryAt);
      // progress the trainer cares about moved: pull fresh assignment progress / submissions
      if (res.sent && before.slice(0, res.sent).some((t) => t !== 'seen')) scheduleRefresh(600);
    } while (again);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

function flushSoon(ms = 1200) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flush();
  }, ms);
}

function enqueue(ops: Op[]) {
  if (!user || !ops.length) return;
  useOutbox.getState().enqueue(user.id, ops);
  flushSoon(300);
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

/** Pull cloud data + learner_state. Safe to call often; returns when done. */
export async function refresh(): Promise<void> {
  const u = user;
  if (!u) return;
  lastRefresh = Date.now();
  if (!u.anonymous && useAccount.getState().pendingMerge) await finishGuestMerge(u.id);
  try {
    if (await pullState(u.id)) {
      useOutbox.getState().markStateDirty(u.id, true);
      flushSoon(0);
    }
  } catch {
    // offline: the cache stays; refreshCloud records `offline`
  }
  if (u.anonymous) return; // guests have no cohorts, reviews or profile to fetch
  await refreshCloud(u.id, u.email);
  syncPerson();
}

function scheduleRefresh(ms: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresh();
  }, ms);
}

/** Foreground / reconnect / pull-to-refresh: retry now, then refresh. */
export async function syncNow(): Promise<void> {
  if (!user) {
    retryAnonymousNow();
    return;
  }
  resetBackoff(user.id);
  stateAttempts = 0;
  await flush();
  await refresh();
}

// ---------------------------------------------------------------------------
// Auth transitions
// ---------------------------------------------------------------------------

/**
 * Practice this device did without an account session: records with no owner (older
 * installs, or before the first anonymous session existed), plus records of an earlier
 * guest on this device whose session is gone.
 */
function guestWork(previousGuest?: string | null) {
  const s = useLearner.getState();
  const mine = (r: { ownerId?: string }) => !r.ownerId || (!!previousGuest && r.ownerId === previousGuest);
  return {
    completions: s.practiceLog.filter(mine),
    sessions: s.sessions.filter(mine),
  };
}

/** Queue a one-time upload of `work` for `id`, and stamp it as theirs. */
function uploadWork(id: string, work: ReturnType<typeof guestWork>, previousGuest?: string | null) {
  if (!work.completions.length && !work.sessions.length) return;
  const ops: Op[] = [...work.sessions.map(sessionOp), ...work.completions.map(completionOp).filter((o): o is Op => !!o)];
  useOutbox.getState().enqueue(id, ops);
  if (previousGuest) useLearner.getState().reownRecords(previousGuest, id);
  useLearner.getState().claimRecords(
    id,
    work.completions.map((r) => r.id),
    work.sessions.map((r) => r.id),
  );
}

/** A guest: an anonymous Supabase user. Practice syncs; nothing account-shaped happens. */
async function anonymousSession(session: Session, fresh: boolean) {
  const id = session.user.id;
  user = { id, email: '', anonymous: true };
  setRecordOwner(id);
  const acct = useAccount.getState();
  const previousGuest = acct.anonymousId && acct.anonymousId !== id ? acct.anonymousId : null;
  acct.set({ status: 'guest', anonymousId: id });

  // practice from before this guest existed goes up once, under this guest
  const work = guestWork(previousGuest);
  const hasWork = work.completions.length + work.sessions.length > 0;
  const dirty = !!useOutbox.getState().stateDirty[id];
  try {
    // a new guest's first document is simply this device's progress
    const needsPush = fresh ? await adoptOnSignIn(id, true) : await pullState(id);
    if (needsPush || dirty) useOutbox.getState().markStateDirty(id, true);
  } catch {
    if (fresh) useOutbox.getState().markStateDirty(id, true);
  }
  if (hasWork) uploadWork(id, work, previousGuest);
  if (previousGuest) useOutbox.getState().rekey(previousGuest, id);
  await flush();
}

/** The guest verified an email (updateUser + verifyOtp): same uid, now a real account. */
async function converted(session: Session) {
  const id = session.user.id;
  const email = session.user.email ?? '';
  user = { id, email, anonymous: false };
  accountLive = true;
  setRecordOwner(id);
  // identify on conversion, never before (docs/tracking-plan.md): the guest's earlier events join this person
  identifyUser(id, { role: 'learner', is_trainer: false, signed_up_at: session.user.created_at, pathway_id: useLearner.getState().activePathwayId });
  useAccount.getState().set({
    status: 'signed-in',
    anonymousId: null,
    pendingMerge: null,
    profile: { id, email, displayName: '', needsName: true },
  });
  track('sign_in_completed', { is_new_user: true, migrated_guest_data: useLearner.getState().practiceLog.length > 0 });
  subscribeRealtime(id);
  await flush();
  await refreshCloud(id, email);
  syncPerson();
}

/**
 * The guest signed in to an existing account: ask the API to move their practice into
 * it (merge-anonymous, with the guest token kept before the switch), then treat the
 * guest's local records and waiting uploads as the account's. Retried on refresh while
 * the network is down; dropped when the guest can no longer be merged.
 */
async function finishGuestMerge(id: string): Promise<boolean> {
  const pending = useAccount.getState().pendingMerge;
  if (!pending || pending.anonId === id) return false;
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return false;
  const learner = useLearner.getState();
  const theirs = {
    completions: learner.practiceLog.filter((r) => r.ownerId === pending.anonId),
    sessions: learner.sessions.filter((r) => r.ownerId === pending.anonId),
  };
  let moved = false;
  let terminal = false;
  try {
    const res = await mergeAnonymous(token, pending.token);
    moved = res.completionsMoved + res.sessionsMoved > 0 || res.learnerState !== 'none';
  } catch (e) {
    const transient = isTransient(e) || (e instanceof ApiError && (e.status >= 500 || e.status === 0));
    if (transient) return false; // try again on the next refresh
    terminal = true; // guest expired, already merged, or gone
  }
  useAccount.getState().set({ pendingMerge: null, anonymousId: null });
  // the guest's records and queued uploads are the account's now
  useLearner.getState().reownRecords(pending.anonId, id);
  useOutbox.getState().rekey(pending.anonId, id);
  // the server couldn't move them: upload this device's copies instead (client_id dedupes)
  if (terminal) {
    const ops: Op[] = [...theirs.sessions.map(sessionOp), ...theirs.completions.map(completionOp).filter((o): o is Op => !!o)];
    if (ops.length) useOutbox.getState().enqueue(id, ops);
  }
  return moved;
}

async function signedIn(session: Session, fresh: boolean, fromGuest: string | null = null) {
  const id = session.user.id;
  const email = session.user.email ?? '';
  const acct = useAccount.getState();
  if (acct.profile && acct.profile.id !== id) acct.clearAccount();
  user = { id, email, anonymous: false };
  accountLive = true;
  setRecordOwner(id);
  // Supabase uuid only; the email stays out of analytics.
  identifyUser(id, { role: 'learner', is_trainer: false, signed_up_at: session.user.created_at, pathway_id: useLearner.getState().activePathwayId });
  useAccount.getState().set({
    status: 'signed-in',
    // a fresh sign-in finishes its own flow (name step) before leaving the welcome
    ...(fresh ? null : { onboarded: true }),
    profile: useAccount.getState().profile ?? {
      id,
      email,
      displayName: '',
      needsName: false,
    },
  });

  // A guest signing in to an existing account: their practice moves on the server.
  const pending = useAccount.getState().pendingMerge;
  const merging = !!pending && pending.anonId !== id && (!fromGuest || pending.anonId === fromGuest);
  // a guest who never practiced doesn't change the account's progress (same as a fresh install signing in)
  const guestPractised =
    merging && useLearner.getState().practiceLog.some((r) => r.ownerId === pending.anonId || !r.ownerId);
  const merged = merging ? await finishGuestMerge(id) : false;

  // Practice made without any session (offline first launch, older installs) uploads to this account.
  const work = guestWork();
  const hasGuestWork = work.completions.length + work.sessions.length > 0;
  const dirty = !!useOutbox.getState().stateDirty[id];
  try {
    const needsPush = fresh ? await adoptOnSignIn(id, hasGuestWork || dirty || guestPractised) : await pullState(id);
    if (needsPush) useOutbox.getState().markStateDirty(id, true);
  } catch {
    // offline right after sign-in: push what we have when the network is back
    if (fresh) useOutbox.getState().markStateDirty(id, true);
  }
  if (fresh) {
    const { last_sign_in_at: signedInAt, email_confirmed_at: confirmedAt } = session.user;
    track('sign_in_completed', {
      // the first sign-in confirms the email at the same moment it signs in
      is_new_user: !!signedInAt && !!confirmedAt && Math.abs(Date.parse(signedInAt) - Date.parse(confirmedAt)) < 5000,
      migrated_guest_data: hasGuestWork || merged,
    });
  }
  uploadWork(id, work);

  subscribeRealtime(id);
  await flush();
  await refreshCloud(id, email);
  syncPerson();
}

/** Person properties that come from the server: trainer status and cohort count. */
let lastPerson = '';
function syncPerson() {
  const { profile, cohorts } = useAccount.getState();
  if (!user || !profile) return;
  const person = {
    role: profile.canTrain ? ('trainer' as const) : ('learner' as const),
    is_trainer: !!profile.canTrain,
    cohort_count: cohorts.length,
    // the account's track can change on adopt / merge
    pathway_id: useLearner.getState().activePathwayId,
  };
  const key = `${user.id}:${JSON.stringify(person)}`;
  if (key === lastPerson) return; // unchanged since the last refresh
  lastPerson = key;
  setPerson(person);
}

function stopSyncing() {
  user = null;
  setRecordOwner(undefined);
  for (const t of [retryTimer, debounceTimer, refreshTimer]) if (t) clearTimeout(t);
  retryTimer = debounceTimer = refreshTimer = null;
  stateAttempts = 0;
  lastRefresh = 0;
  lastPerson = '';
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
}

/**
 * Forget everything the signed-out account left on this device, so the next person
 * (clinicians share devices) starts as a brand-new learner: the learner store, the
 * outbox, the cached cohorts / assignments / submissions / reviews / inbox / name, the
 * welcome, and the analytics identity. The persisted AsyncStorage / localStorage copies
 * go too. Runs once per account; concurrent callers share it.
 */
export function resetDevice(): Promise<void> {
  if (wiping) return wiping;
  if (!accountLive) return Promise.resolve();
  accountLive = false;
  wiping = (async () => {
    track('signed_out');
    await wipeDevice();
  })().finally(() => {
    wiping = null;
  });
  return wiping;
}

/** Everything `resetDevice` forgets, for an account or a guest. */
async function wipeDevice() {
  stopSyncing();
  useLearner.getState().wipe();
  useOutbox.getState().clear();
  useAccount.getState().resetAll();
  resetAnalytics();
  // the stores persist on every change; drop the stored copies of the two that would otherwise
  // keep the old person's data until the next write (the account store keeps `onboarded: false`)
  await Promise.all([useLearner.persist.clearStorage(), useOutbox.persist.clearStorage()]).catch(() => {});
}

/**
 * A guest starting over (Me › Account): back to the welcome as a brand-new guest. Wipe first,
 * then drop the anonymous session: a lost guest session otherwise hands its practice to the
 * next guest (`signedOut`), and the new anonymous user must start empty. The old guest's
 * server row is left behind, unreachable.
 */
export async function startOverAsGuest(): Promise<void> {
  if (wiping) return wiping;
  wiping = (async () => {
    track('guest_started_over');
    await wipeDevice();
    if (supabaseConfigured) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  })().finally(() => {
    wiping = null;
  });
  return wiping;
}

/**
 * Before signing out: send everything still waiting, giving up after `timeoutMs`.
 * Resolves true when nothing is left that exists only on this device. Offline (or a
 * slow network) resolves false: the caller warns before the wipe loses it.
 */
export async function flushBeforeSignOut(timeoutMs = 8000): Promise<boolean> {
  const u = user;
  if (!u) return true;
  resetBackoff(u.id);
  stateAttempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([flush(), new Promise<void>((r) => (timer = setTimeout(r, timeoutMs)))]);
  if (timer) clearTimeout(timer);
  const { entries, stateDirty } = useOutbox.getState();
  // a flush still running past the timeout may not have landed
  return !flushing && !entries.some((e) => e.userId === u.id) && !stateDirty[u.id];
}

function signedOut(wasGuest: boolean) {
  if (wasGuest) {
    // a guest whose session was lost keeps their practice; the next guest picks it up
    stopSyncing();
    useAccount.getState().clearAccount();
    void ensureSession();
    return;
  }
  // an account signed out (on purpose, or its session was revoked): the device starts clean
  void resetDevice().then(() => ensureSession());
}

function subscribeRealtime(userId: string) {
  if (channel) void supabase.removeChannel(channel);
  // `reviews` and `submissions` are in the supabase_realtime publication; RLS limits events to this learner's rows.
  // a fresh topic each time: supabase.channel() hands back an existing (already subscribed) channel by name
  channel = supabase
    .channel(`learner-${userId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => scheduleRefresh(300))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => scheduleRefresh(300))
    .subscribe();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/** First launch shows the welcome; existing guest installs and stored sessions skip it. */
async function decideOnboarding(hasSession: boolean) {
  const acct = useAccount.getState();
  if (acct.onboarded !== null) return;
  if (hasSession) return acct.set({ onboarded: true });
  acct.set({ onboarded: await hadLearnerData });
}

function waitForHydration(): Promise<void> {
  const stores = [useAccount.persist, useOutbox.persist, useLearner.persist];
  return Promise.all(
    stores.map(
      (p) =>
        new Promise<void>((res) => {
          if (p.hasHydrated()) return res();
          const off = p.onFinishHydration(() => {
            off();
            res();
          });
        }),
    ),
  ).then(() => undefined);
}

export function startSync() {
  if (started) return;
  started = true;

  void (async () => {
    await waitForHydration();
    if (!supabaseConfigured) {
      useAccount.getState().set({ status: 'guest' });
      await decideOnboarding(false);
      return;
    }

    let booted = false;
    let lastUserId: string | null = null;
    let lastAnonymous = false;
    const handle = (event: AuthChangeEvent, session: Session | null) => {
      setCurrentSession(session);
      const nextId = session?.user.id ?? null;
      const anonymous = !!session?.user.is_anonymous;
      if (event === 'INITIAL_SESSION' || !booted) {
        booted = true;
        lastUserId = nextId;
        lastAnonymous = anonymous;
        // a stored guest session isn't a reason to skip the welcome
        void decideOnboarding(!!session && !anonymous);
        if (session && anonymous) void anonymousSession(session, false);
        else if (session) void signedIn(session, false);
        else {
          useAccount.getState().set({ status: 'guest' });
          void ensureSession(); // first launch: become a guest quietly (retries while offline)
        }
        return;
      }
      if (nextId === lastUserId) {
        // same uid: token refresh, user update, or the guest just verified an email
        if (session && lastAnonymous && !anonymous) {
          lastAnonymous = false;
          void converted(session);
        }
        return;
      }
      const fromGuest = lastAnonymous ? lastUserId : null;
      const wasGuest = lastAnonymous;
      lastUserId = nextId;
      lastAnonymous = anonymous;
      if (session && anonymous) void anonymousSession(session, true);
      else if (session) void signedIn(session, true, fromGuest);
      else signedOut(wasGuest);
    };
    // supabase-js warns against awaiting other supabase calls inside the callback
    supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => handle(event, session), 0);
    });
  })();

  // New practice → outbox; synced-state edits → dirty flag.
  useLearner.subscribe((s, prev) => {
    if (!user) return;
    const uid = user.id;
    if (s.practiceLog !== prev.practiceLog) {
      const known = new Set(prev.practiceLog.map((r) => r.id));
      enqueue(
        s.practiceLog
          .filter((r) => !known.has(r.id) && r.ownerId === uid)
          .map(completionOp)
          .filter((o): o is Op => !!o),
      );
    }
    if (s.sessions !== prev.sessions) {
      const known = new Set(prev.sessions.map((r) => r.id));
      enqueue(s.sessions.filter((r) => !known.has(r.id) && r.ownerId === uid).map(sessionOp));
    }
    if (!applyingRemote && SYNCED_KEYS.some((k) => s[k] !== prev[k])) {
      useOutbox.getState().markStateDirty(uid, true);
      flushSoon();
    }
  });

  AppState.addEventListener('change', (state) => {
    if (state === 'active' && !user) retryAnonymousNow();
    if (state !== 'active' || !user) return;
    resetBackoff(user.id);
    void flush();
    if (Date.now() - lastRefresh > 15_000) void refresh();
  });

  let wasOnline = true;
  try {
    Network.addNetworkStateListener((st) => {
      const online = !!st.isConnected && st.isInternetReachable !== false;
      if (online && !wasOnline) void syncNow();
      wasOnline = online;
    });
  } catch {
    // web without the Network Information API: foreground + backoff still cover it
  }
  onSimulatedOfflineChange((off) => {
    if (!off) void syncNow();
  });
}

// ---------------------------------------------------------------------------
// Learner actions that write to the server
// ---------------------------------------------------------------------------

/**
 * Send one practice session to a cohort's trainer. Queues the session (idempotent if
 * it's already uploaded) and a new submission; the UI shows it as submitted at once.
 * A session that was withdrawn can be shared again: that's a new submission row with
 * a new id (the withdrawn one stays as history). While one is active, a second tap
 * returns it instead of queuing a duplicate.
 */
export function submitForReview(
  target: { sessionId: string; kind: 'roleplay' | 'drill'; refId: string; session?: PracticeSession },
  cohortId: string,
  note: string,
): Submission | null {
  if (!permanent()) return null; // guests sign in first (the review sheet asks)
  const active = useAccount.getState().submissions.find((x) => x.sessionId === target.sessionId && x.status !== 'withdrawn');
  if (active) return active;
  const sub: Submission = {
    id: uuid(),
    sessionId: target.sessionId,
    cohortId,
    kind: target.kind,
    refId: target.refId,
    note: note || null,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    local: true,
  };
  useAccount.getState().addLocalSubmission(sub);
  // the note to the trainer is free text: never sent
  track('submission_created', { kind: target.kind, ref_id: target.refId });
  enqueue([
    // a session from another device is already on the server; only this device's copy needs uploading
    ...(target.session ? [sessionOp(target.session)] : []),
    { type: 'submission', row: { id: sub.id, session_id: target.sessionId, cohort_id: cohortId, note_to_trainer: sub.note } },
  ]);
  return sub;
}

/** Take a submission back while it's still waiting for review. */
export function withdrawSubmission(id: string) {
  if (!permanent()) return;
  useAccount.getState().setSubmissionStatus(id, 'withdrawn');
  track('submission_withdrawn');
  enqueue([{ type: 'withdraw', submissionId: id }]);
}

/** The learner opened a review. */
export function markReviewSeen(reviewId: string) {
  if (!permanent()) return;
  const r = useAccount.getState().reviews.find((x) => x.id === reviewId);
  if (!r || r.learnerSeenAt) return;
  const at = new Date().toISOString();
  useAccount.getState().markReviewSeen(reviewId, at);
  enqueue([{ type: 'seen', reviewId, at }]);
}
