import { create } from 'zustand';

/** A streak milestone waiting for, or playing, its full-screen moment. */
export interface MilestoneMoment {
  milestone: number;
  /** The streak before the practice that crossed it: the number rolls up from here. */
  from: number;
}

interface Moments {
  /** Crossed by a practice; held until the completion screen's ticks have landed. */
  queued: MilestoneMoment | null;
  /** On screen now (MilestoneHost). */
  showing: MilestoneMoment | null;
  queue: (m: MilestoneMoment) => void;
  /** Play the queued moment, if any (the ticks landed, or Home came back into view). */
  release: () => void;
  dismiss: () => void;
}

/**
 * One-off celebration moments. Device-only and not persisted: a moment that never got its
 * turn (the app closed first) is skipped, never replayed later out of context. Whether a
 * milestone was celebrated lives in the synced document (`milestones`), not here.
 */
export const useMoments = create<Moments>()((set, get) => ({
  queued: null,
  showing: null,
  queue: (m) => set({ queued: m }),
  release: () => {
    const { queued, showing } = get();
    if (queued && !showing) set({ queued: null, showing: queued });
  },
  dismiss: () => set({ showing: null }),
}));
