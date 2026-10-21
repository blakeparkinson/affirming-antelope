import type { Turn } from '@antelope/core';
import type { FriendlyError } from '../practice-loop/errorCopy';

/**
 * Exchanges the persona actually answered: learner lines with a reply right after them.
 * A line that failed to send, or is still waiting, isn't an exchange yet. (The header's
 * "N replies from you" counts the learner's own lines, which is what it says.)
 */
export function answeredExchanges(turns: readonly Turn[]): number {
  let n = 0;
  for (let i = 0; i < turns.length - 1; i++) if (turns[i].speaker === 'learner' && turns[i + 1].speaker === 'employee') n++;
  return n;
}

/** The End sheet's body: how much the debrief has to go on, counted in answered exchanges. */
export function endSheetBody(answered: number, name: string): string {
  const after = 'Ending now is fine; the debrief just has less to go on. A few more replies usually tells you more.';
  if (answered === 0) return `${name} hasn’t answered yet. ${after}`;
  return `You’ve had ${answered} ${answered === 1 ? 'exchange' : 'exchanges'} with ${name}. ${after}`;
}

/** The line under a reply that didn't arrive. */
export function failedTurnLine(error: FriendlyError, name: string): string {
  if (error.kind === 'wait') return `${error.title}. ${error.detail}`;
  if (error.kind === 'session') return `${error.title}, so ${name} didn’t get that. ${error.detail}`;
  return `${error.title}. ${name} didn’t get that.`;
}

/**
 * One reply request out at a time. A new request takes it (stopping the old one first,
 * as a spoken cut-in does); Resend only goes when it's free, so a double tap sends once.
 */
export interface ReplyGate {
  readonly busy: boolean;
  /** False if a request already holds it. */
  take(): boolean;
  release(): void;
}

export function createReplyGate(): ReplyGate {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    take() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() {
      busy = false;
    },
  };
}
