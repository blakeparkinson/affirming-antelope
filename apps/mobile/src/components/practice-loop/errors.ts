import { describeError, type FriendlyError } from './errorCopy';
import { useAccount } from '@/state/account';

export { whenAgain, type FriendlyError } from './errorCopy';

/** Turn a failed request into coach-voice copy (errorCopy.ts). */
export function friendlyError(err: unknown): FriendlyError {
  return describeError(err, { signedIn: useAccount.getState().status === 'signed-in' });
}

/** AbortController that also fires after `ms`. Call `clear()` when done. */
export function withTimeout(ms: number, outer?: AbortSignal) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  outer?.addEventListener('abort', () => ctrl.abort());
  return { signal: ctrl.signal, abort: () => ctrl.abort(), clear: () => clearTimeout(t) };
}
