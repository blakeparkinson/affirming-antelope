import { DEFAULT_APP_INGEST_HOST, scrubProps, type AnalyticsPersonProps, type PracticeSource, type TrackFn } from '@antelope/core';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { client } from './analyticsClient';
import type { Props } from './analyticsTypes';

/**
 * PostHog for the learner app (docs/tracking-plan.md). The one module the app imports.
 *
 * - No `EXPO_PUBLIC_POSTHOG_KEY`, or an opt-out signal on web (Do Not Track / Global
 *   Privacy Control): never starts; every call is a no-op.
 * - Ids and enums only. `scrubProps` drops anything that looks like free text.
 * - Web uses posthog-js, native uses posthog-react-native (`analyticsClient.*.ts`).
 * - No touch autocapture, no session replay.
 */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || DEFAULT_APP_INGEST_HOST).replace(/\/+$/, '');

let on = false;
let started = false;
/** The app was opened from a website guide: the first practice it starts is `source: 'guide'`. */
let guideLaunchPending = false;

function superProps(signedIn: boolean): Props {
  return {
    surface: 'app',
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    app_version: Constants.expoConfig?.version ?? 'unknown',
    signed_in: signedIn,
  };
}

/** Starts PostHog once and sends `app_opened`. Call at module load, before the first screen. */
export function startAnalytics(): void {
  if (started || !KEY) return;
  started = true;
  on = client.start({ key: KEY, host: HOST, superProps: superProps(false) });
  if (!on) return;
  void client.launch().then(({ entry, src }) => {
    if (entry === 'guide') guideLaunchPending = true;
    track('app_opened', { entry, ...(src ? { src } : {}) });
  });
}

export const track: TrackFn = (name, ...args) => {
  if (!on) return;
  client.capture(name, scrubProps(args[0]));
};

/** A screen view from the router pathname (`$pageview` on web, `$screen` on native). */
let lastScreen = '';
export function screenView(pathname: string): void {
  // Strict Mode (dev) runs effects twice; the same path twice in a row is one view.
  if (!on || pathname === lastScreen) return;
  lastScreen = pathname;
  client.screen(pathname);
}

/** Identify by Supabase user uuid. Never pass an email or a name. */
export function identifyUser(userId: string, person: AnalyticsPersonProps): void {
  if (!on) return;
  client.register({ signed_in: true });
  client.identify(userId, scrubProps(person));
}

/** Update person properties as they change (cohort count, trainer status). */
export function setPerson(person: Partial<AnalyticsPersonProps>): void {
  if (on) client.setPerson(scrubProps(person));
}

/** Sign-out: forget the identity on this device and go back to an anonymous guest. */
export function resetAnalytics(): void {
  if (on) client.reset(superProps(false));
}

/**
 * Maps a route's `source` param (data/routes.ts) to the tracking plan's vocabulary. A practice
 * opened without one, right after launching from a website guide, is `guide`.
 */
export function practiceSource(raw?: string): PracticeSource {
  if (!raw && guideLaunchPending) {
    guideLaunchPending = false;
    return 'guide';
  }
  switch (raw) {
    case 'practice':
      return 'practice_tab';
    case 'review':
      return 'review_recommendation';
    case 'assignment':
    case 'path':
    case 'challenge':
    case 'guide':
    case 'next_step':
    case 'refresh':
      return raw;
    default:
      return 'today';
  }
}
