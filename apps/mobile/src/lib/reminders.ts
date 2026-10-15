import { noFreezeHistory, planReminders, type ReminderPrefs, type ReminderSource } from '@antelope/core';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { currentDailyRep, startDailyRep } from '@/data/dailyRep';
import { track } from '@/lib/analytics';
import { useLearner, type LearnerState } from '@/state/store';
import { notifier } from './notify';
import type { NotifyPermission, ReminderOpen } from './notifyTypes';

/**
 * Practice reminders: local notifications, planned by `planReminders` in @antelope/core.
 * Whenever something the plan reads changes (a practice, the reminder setting, sign-out,
 * another device's practice arriving through sync) or the app comes back to the
 * foreground, everything is cancelled and the plan scheduled again. Runs are serialised,
 * and a burst of changes collapses into one run that reads the latest state.
 */

let chain: Promise<void> = Promise.resolve();
let queued = false;

export function syncReminders(): Promise<void> {
  if (!notifier.supported) return Promise.resolve();
  if (queued) return chain;
  queued = true;
  chain = chain
    .then(async () => {
      queued = false;
      const s = useLearner.getState();
      const prefs = s.settings.reminders;
      // with permission revoked in Settings, clear what's left instead of scheduling into the void
      const plan = prefs?.on && (await notifier.permission()) === 'granted' ? planReminders({ prefs, streak: s.streak, freezes: s.freezes ?? noFreezeHistory() }) : [];
      await notifier.replaceAll(plan);
    })
    .catch(() => {});
  return chain;
}

/** What the plan reads, as one comparable key. */
function inputsKey(s: LearnerState): string {
  const r = s.settings.reminders;
  const f = s.freezes ?? noFreezeHistory();
  return [s.streak.lastPracticeDay, s.streak.days, f.earnedDays.join(','), f.usedDays.join(','), r?.on, r?.hour, r?.minute].join('|');
}

let started = false;

/** Call once at launch: keeps the schedule in step with the store and the clock. */
export function startReminders(): void {
  if (started || !notifier.supported) return;
  started = true;
  const begin = () => {
    let last = inputsKey(useLearner.getState());
    syncReminders();
    useLearner.subscribe((s) => {
      const key = inputsKey(s);
      if (key === last) return;
      last = key;
      syncReminders();
    });
    // a new day (or a permission change in Settings) while the app was away
    AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders();
    });
  };
  if (useLearner.persist.hasHydrated()) begin();
  else {
    const unsub = useLearner.persist.onFinishHydration(() => {
      unsub();
      begin();
    });
  }
}

/** A tap that came in before the app could navigate (the one that launched it). */
let pending: ReminderOpen | null = null;
let deliver: ((open: ReminderOpen) => void) | null = null;

/** Reminder taps: counted, then routed by `useReminderTaps` (held until it's mounted). */
export function onReminderOpened(listener?: (open: ReminderOpen) => void): () => void {
  return notifier.onOpen((open) => {
    if (open.kind) track('reminder_opened', { kind: open.kind });
    listener?.(open);
    if (deliver) deliver(open);
    else pending = open;
  });
}

/**
 * Root layout: a tapped reminder opens today's rep, once the app can navigate (`canRoute`:
 * hydrated, onboarded, splash gone). Only from a tab screen: a tap that lands mid-session
 * just brings the app back to that session. Once today's rep is done there's nothing to
 * open, so the app stays where it was.
 */
export function useReminderTaps(canRoute: boolean, onTabs: boolean): void {
  const onTabsRef = useRef(onTabs);
  onTabsRef.current = onTabs;
  useEffect(() => {
    if (!canRoute) return;
    const route = () => {
      if (!onTabsRef.current) return;
      const rep = currentDailyRep();
      if (rep && !rep.done) startDailyRep(rep, rep.drillId, 'reminder');
    };
    deliver = route;
    if (pending) {
      pending = null;
      route();
    }
    return () => {
      deliver = null;
    };
  }, [canRoute]);
}

/**
 * Turn reminders on at `time`: asks for permission first when it still can. Returns the
 * permission; reminders are only switched on when it's granted.
 */
export async function turnOnReminders(time: Pick<ReminderPrefs, 'hour' | 'minute'>, source: ReminderSource): Promise<NotifyPermission> {
  const permission = await notifier.request();
  if (permission !== 'granted') {
    track('reminder_declined', { source, reason: 'permission_denied' });
    return permission;
  }
  useLearner.getState().setSetting('reminders', { on: true, hour: time.hour, minute: time.minute });
  track('reminder_opt_in', { source, hour: time.hour, minute: time.minute });
  return permission;
}

/** Me › Reminders: switch off, or move the time (keeps the time when switched off). */
export function updateReminders(next: ReminderPrefs): void {
  useLearner.getState().setSetting('reminders', next);
  track('reminder_settings_changed', { on: next.on, hour: next.hour, minute: next.minute });
}

/** The notification permission, re-read whenever the app comes back to the foreground. */
export function useNotifyPermission(): NotifyPermission | null {
  const [p, setP] = useState<NotifyPermission | null>(notifier.supported ? null : 'unsupported');
  useEffect(() => {
    if (!notifier.supported) return;
    let live = true;
    const read = () =>
      notifier
        .permission()
        .then((v) => live && setP(v))
        .catch(() => {});
    read();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && read());
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return p;
}

export const remindersSupported = notifier.supported;
export const openNotificationSettings = () => notifier.openSettings();
