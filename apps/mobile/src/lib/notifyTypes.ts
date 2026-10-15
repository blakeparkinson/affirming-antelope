import type { PlannedReminder, ReminderKind } from '@antelope/core';

/** `unsupported`: this platform can't schedule local notifications (web). */
export type NotifyPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** What a tapped reminder carries back to the app. */
export interface ReminderOpen {
  kind: ReminderKind | undefined;
  /** The scheduled notification's id, to tell one tap from another. */
  id: string;
}

/** The device's notification system, as far as reminders need it. */
export interface Notifier {
  supported: boolean;
  permission: () => Promise<NotifyPermission>;
  /** Shows the system prompt when it still can; otherwise returns the current answer. */
  request: () => Promise<NotifyPermission>;
  /** Cancel everything this app scheduled, then schedule `plan`. */
  replaceAll: (plan: PlannedReminder[]) => Promise<void>;
  /** Taps on a reminder, including the one that launched the app. Returns an unsubscribe. */
  onOpen: (listener: (open: ReminderOpen) => void) => () => void;
  /** The app's page in the system Settings, where blocked notifications are turned back on. */
  openSettings: () => void;
}
