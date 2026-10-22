/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Turn } from '@antelope/core';
import { describeError } from '../src/components/practice-loop/errorCopy';
import { answeredExchanges, createReplyGate, endSheetBody, failedTurnLine } from '../src/components/roleplay/turnFlow';
import { ApiError } from '../src/lib/apiError';
import { tokenAfter401, type AuthRecovery, type SessionLike } from '../src/lib/authRetry';

const guest = (token: string): SessionLike => ({ access_token: token, user: { id: `guest-${token}`, is_anonymous: true } });
const account = (token: string): SessionLike => ({ access_token: token, user: { id: `acct-${token}`, is_anonymous: false } });

function recovery(o: { current?: SessionLike | null; refreshed?: SessionLike | null; rejected?: boolean; fresh?: SessionLike | null }) {
  const calls = { refresh: 0, freshGuest: 0, dead: undefined as SessionLike | null | undefined };
  const r: AuthRecovery = {
    current: () => o.current ?? null,
    refresh: async () => (calls.refresh++, { session: o.refreshed ?? null, rejected: o.rejected ?? true }),
    freshGuest: async (dead) => (calls.freshGuest++, (calls.dead = dead), o.fresh ?? null),
  };
  return { r, calls };
}

const t = (id: string, speaker: Turn['speaker'], text = id): Turn => ({ id, speaker, text });

describe('a 401 from the coach', () => {
  it('retries with the refreshed token when the refresh works, without a new guest', async () => {
    const { r, calls } = recovery({ current: guest('old'), refreshed: guest('new') });
    assert.equal(await tokenAfter401(r), 'new');
    assert.equal(calls.freshGuest, 0);
  });

  it('starts a fresh guest when the guest’s refresh token is turned down (guest deleted)', async () => {
    const { r, calls } = recovery({ current: guest('old'), refreshed: null, rejected: true, fresh: guest('fresh') });
    assert.equal(await tokenAfter401(r), 'fresh');
    assert.equal(calls.freshGuest, 1);
    // it names the dead session, so a session that replaced it meanwhile isn't signed out
    assert.equal(calls.dead?.access_token, 'old');
  });

  it('starts a guest when the request went without any session (auth_required)', async () => {
    const { r } = recovery({ current: null, refreshed: null, fresh: guest('fresh') });
    assert.equal(await tokenAfter401(r), 'fresh');
  });

  it('never swaps an account for a guest', async () => {
    const { r, calls } = recovery({ current: account('acct'), refreshed: null, rejected: true, fresh: guest('fresh') });
    assert.equal(await tokenAfter401(r), null);
    assert.equal(calls.freshGuest, 0);
  });

  it('keeps a guest whose refresh couldn’t reach the auth server', async () => {
    const { r, calls } = recovery({ current: guest('old'), refreshed: null, rejected: false, fresh: guest('fresh') });
    assert.equal(await tokenAfter401(r), null);
    assert.equal(calls.freshGuest, 0);
  });

  it('gives up when a fresh guest can’t be made either', async () => {
    const { r } = recovery({ current: null, refreshed: null, fresh: null });
    assert.equal(await tokenAfter401(r), null);
  });

  it('is a session stop, not a connection one, in the copy', () => {
    const e = describeError(new ApiError(401, 'invalid_token', { code: 'invalid_token' }), { signedIn: false });
    assert.equal(e.kind, 'session');
    assert.doesNotMatch(`${e.title} ${e.detail}`, /connection|offline/i);
    assert.match(failedTurnLine(e, 'Josh'), /Josh didn’t get that/);
    assert.match(failedTurnLine(e, 'Josh'), /Try again/);
  });

  it('still calls a dropped connection a connection problem', () => {
    assert.equal(describeError(new TypeError('Network request failed'), { signedIn: false }).kind, 'offline');
  });
});

describe('Resend tapped twice', () => {
  it('sends once: the second tap finds the reply already out', () => {
    const gate = createReplyGate();
    const sent: number[] = [];
    const resend = () => {
      if (gate.busy) return;
      gate.take();
      sent.push(sent.length);
    };
    resend();
    resend();
    assert.equal(sent.length, 1);
    // the reply fails again: Resend works again
    gate.release();
    resend();
    assert.equal(sent.length, 2);
  });

  it('lets a new request take over after the old one is stopped (a spoken cut-in)', () => {
    const gate = createReplyGate();
    assert.equal(gate.take(), true);
    assert.equal(gate.take(), false);
    gate.release();
    assert.equal(gate.take(), true);
  });
});

describe('exchanges counted for the End sheet', () => {
  const opening = t('t0', 'employee');

  it('is zero when they never answered, and says so', () => {
    const turns = [opening, t('t1', 'learner')];
    assert.equal(answeredExchanges(turns), 0);
    assert.equal(answeredExchanges([opening]), 0);
    assert.equal(answeredExchanges([]), 0);
    assert.equal(endSheetBody(0, 'Josh').startsWith('Josh hasn’t answered yet.'), true);
  });

  it('counts the earlier answered turns, not the one that failed after them', () => {
    const turns = [opening, t('t1', 'learner'), t('t2', 'employee'), t('t3', 'learner'), t('t4', 'employee'), t('t5', 'learner')];
    assert.equal(answeredExchanges(turns), 2);
    assert.match(endSheetBody(2, 'Josh'), /^You’ve had 2 exchanges with Josh\./);
  });

  it('counts a new line sent after a failure once, when the reply to both arrives', () => {
    const failed = [opening, t('t1', 'learner'), t('t2', 'employee'), t('t3', 'learner')];
    const typedAgain = [...failed, t('t4', 'learner')];
    assert.equal(answeredExchanges(typedAgain), 1);
    assert.equal(answeredExchanges([...typedAgain, t('t5', 'employee')]), 2);
    assert.match(endSheetBody(1, 'Josh'), /^You’ve had 1 exchange with Josh\./);
  });
});
