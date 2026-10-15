import { dayKey, type DayKey } from '@antelope/core';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

/**
 * Today's day key, kept current for screens that stay mounted (Home under the tabs). It
 * turns over at local midnight and is re-read whenever the app comes back to the foreground,
 * since a day, or a time zone, may have passed while it was away. One timer and one
 * AppState listener, shared by every reader, running only while something reads it.
 */

/** The day listeners were last told about. */
let day: DayKey = dayKey();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let appState: { remove: () => void } | undefined;

/** A moment after the next local midnight. */
function untilTomorrow(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1).getTime() - now.getTime();
}

function check() {
  clearTimeout(timer);
  timer = setTimeout(check, untilTomorrow());
  const next = dayKey();
  if (next === day) return;
  day = next;
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

export function useToday(): DayKey {
  // read fresh each render (a string, so an unchanged day is the same snapshot)
  return useSyncExternalStore(subscribe, dayKey, dayKey);
}
