import { isLearnerMove, isStance, type LearnerMove, type Stance, type Turn } from '@antelope/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError, withTimeout, type FriendlyError } from '@/components/practice-loop/errors';
import { postStream } from '@/lib/api';

export interface PendingReply {
  id: string;
  text: string;
  /** Still "thinking": show the typing dots. */
  typing: boolean;
  /** How they're saying it (warmth.ts), known once the reply starts; never shown as a label. */
  stance?: Stance;
}

const TICK = 33;

/** Optional listener for the raw reply stream (Talk mode speaks it sentence by sentence). */
/** The role-player's private read, which arrives with the reply's headers, before any words. */
export interface ReplyRead {
  /** How the learner's last line read (liveMoves.ts). */
  move?: LearnerMove;
  /** The stance the reply is played in. */
  stance?: Stance;
}

export interface ReplyStreamSink {
  push(chunk: string): void;
  end(): void;
  fail(): void;
}

/**
 * Streams the employee's reply with a believable rhythm. A short pause to
 * read (longer for longer messages), typing dots, then the text reveals at a
 * steady speaking pace, a word at a time, from a buffer, so network chunk
 * sizes never show. It speeds up gently if the buffer runs far ahead.
 */
export function useEmployeeReply(scenarioId: string) {
  const [pending, setPending] = useState<PendingReply | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const live = useRef<{ stop: () => void } | null>(null);

  useEffect(() => () => live.current?.stop(), []);

  const request = useCallback(
    (turns: Turn[], replyId: string, onDone: (text: string, stance?: Stance) => void, sink?: ReplyStreamSink, onRead?: (read: ReplyRead) => void) => {
      live.current?.stop();
      setError(null);
      const lastLearner = [...turns].reverse().find((t) => t.speaker === 'learner')?.text ?? '';
      const thinkUntil = Date.now() + 650 + Math.random() * 550 + Math.min(700, lastLearner.length * 5);
      let buffer = '';
      let shown = 0;
      let budget = 0;
      let streamDone = false;
      let failure: unknown = null;
      let last = Date.now();
      let stopped = false;
      let stance: Stance | undefined;

      setPending({ id: replyId, text: '', typing: true });
      const req = withTimeout(30_000);

      const finish = (text: string) => {
        stop();
        setPending(null);
        onDone(text.trim(), stance);
      };

      const tick = setInterval(() => {
        const now = Date.now();
        const dt = now - last;
        last = now;
        if (failure && shown >= buffer.length) {
          stop();
          setPending(null);
          if (shown > 0) onDone(buffer.slice(0, shown).trim(), stance);
          else setError(friendlyError(failure));
          return;
        }
        if (now < thinkUntil || shown >= buffer.length) {
          if (streamDone && shown >= buffer.length && now >= thinkUntil) finish(buffer);
          return;
        }
        const remaining = buffer.length - shown;
        const cps = remaining > 180 ? 110 : remaining > 70 ? 70 : 46;
        budget += (dt * cps) / 1000;
        if (budget < 1) return;
        let next = shown + Math.floor(budget);
        // end on a word boundary so words arrive whole
        while (next < buffer.length && !/\s/.test(buffer[next])) next++;
        next = Math.min(next, buffer.length);
        budget -= next - shown;
        shown = next;
        setPending({ id: replyId, text: buffer.slice(0, shown), typing: false, stance });
        if (streamDone && shown >= buffer.length) finish(buffer);
      }, TICK);

      function stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(tick);
        req.clear();
        req.abort();
      }
      live.current = { stop };

      postStream(
        '/api/roleplay/turn',
        { scenarioId, turns },
        (chunk) => {
          buffer += chunk;
          sink?.push(chunk);
        },
        req.signal,
        (headers) => {
          const s = headers.get('x-stance');
          if (isStance(s)) stance = s;
          const m = headers.get('x-move');
          if (!stopped) onRead?.({ move: isLearnerMove(m) ? m : undefined, stance });
        },
      )
        .then((full) => {
          if (full && full.length >= buffer.length) buffer = full;
          streamDone = true;
          sink?.end();
        })
        .catch((e) => {
          sink?.fail();
          if (stopped) return;
          failure = e;
        });
    },
    [scenarioId],
  );

  /** Stop streaming now, keeping whatever has been revealed. */
  const cut = useCallback((): string => {
    const text = pending?.text ?? '';
    live.current?.stop();
    setPending(null);
    return text;
  }, [pending]);

  return { pending, error, request, cut, clearError: () => setError(null) };
}
