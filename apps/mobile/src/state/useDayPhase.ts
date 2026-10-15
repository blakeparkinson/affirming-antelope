import { nextPhaseChange, phaseAt, type DayPhase } from '@antelope/core';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

/**
 * The time of day the Path is lit for (dawn, day, dusk, night), by local time. It turns
 * over at each boundary and is re-read whenever the app comes back to the foreground. One
 * timer and one AppState listener, shared by every reader, running only while something
 * reads it (the pattern of useToday).
 *
 * Dev: `setDayPhaseOverride` pins a phase (antelope://dev/path?time=dusk); null follows the clock.
 */

let override: DayPhase | null = null;
let phase: DayPhase = phaseAt(new Date());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let appState: { remove: () => void } | undefined;

const read = (): DayPhase => override ?? phaseAt(new Date());

function check() {
  clearTimeout(timer);
  const now = new Date();
  // a moment after the boundary, so the new phase has begun
  timer = setTimeout(check, nextPhaseChange(now).getTime() - now.getTime() + 1000);
  const next = read();
  if (next === phase) return;
  phase = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    check();
    appState = AppState.addEventListener('change', (s) => s === 'active' && check());
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearTimeout(timer);
    appState?.remove();
  };
}

// with nobody listening the cached phase may be stale (no timer runs), so read it fresh
const snapshot = () => (listeners.size ? phase : (phase = read()));

export function useDayPhase(): DayPhase {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Dev only: light the Path as if it were `p` (null: follow the clock again). */
export function setDayPhaseOverride(p: DayPhase | null) {
  override = p;
  phase = read();
  listeners.forEach((l) => l());
}
