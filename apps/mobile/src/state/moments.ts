import type { SkillId } from '@antelope/core';
import { create } from 'zustand';
import { EMPTY_QUEUE, dismiss, enqueue, release, type Moment, type MomentQueue } from './momentQueue';

export type { LevelUpMoment, MilestoneMoment, Moment } from './momentQueue';

/** The weekly recap on screen (RecapHost). */
export interface RecapMoment {
  /** Monday of the week recapped. */
  weekStart: string;
  /** Me › Demo's preview: no analytics, and the seen mark isn't touched. */
  preview?: boolean;
}

/** After one moment closes, the next waits this long so the two read as separate beats. */
export const NEXT_MOMENT_AFTER = 350;

interface Moments extends MomentQueue {
  /** Crossed by a practice; held until the completion screen's ticks have landed. */
  queue: (m: Moment) => void;
  /** Play the next waiting moment, if any (the ticks landed, Home came back into view, or the last one closed). */
  release: () => void;
  /** The moment on screen is done; the next one follows after a beat. */
  dismiss: () => void;
  /** The weekly recap, while it's open. Completion moments wait until it closes. */
  recap: RecapMoment | null;
  showRecap: (r: RecapMoment) => void;
  /** `release`: play a waiting moment now (a dismissal back to Home; not when a drill just opened). */
  closeRecap: (release: boolean) => void;
  /** Skills that levelled up since Me last showed them: their row glows once. */
  levelled: SkillId[];
  /** Me showed the glow. */
  clearLevelled: () => void;
}

let nextTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * One-off celebration moments, played one at a time (see momentQueue: the streak, then the
 * skill). Device-only and not persisted: a moment that never got its turn (the app closed
 * first) is skipped, never replayed later out of context. Whether a milestone was celebrated
 * lives in the synced document (`milestones`), not here.
 */
export const useMoments = create<Moments>()((set, get) => ({
  ...EMPTY_QUEUE,
  queue: (m) =>
    set((s) => ({
      ...enqueue(s, m),
      levelled: m.kind === 'level-up' && !s.levelled.includes(m.skill) ? [...s.levelled, m.skill] : s.levelled,
    })),
  release: () => set((s) => release(s, !!s.recap)),
  dismiss: () => {
    set((s) => dismiss(s));
    clearTimeout(nextTimer);
    if (get().pending.length) nextTimer = setTimeout(() => get().release(), NEXT_MOMENT_AFTER);
  },
  recap: null,
  showRecap: (r) => set({ recap: r }),
  closeRecap: (rel) => {
    set({ recap: null });
    if (rel) get().release();
  },
  levelled: [],
  clearLevelled: () => set({ levelled: [] }),
}));
