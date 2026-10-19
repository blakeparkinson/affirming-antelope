import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_ORIGIN, DEFAULT_APP_INGEST_HOST, isInternalTraffic, scrubProps, type AnalyticsPersonProps, type PracticeSource, type TrackFn } from '@antelope/core';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
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
 * - Team, test and preview traffic carries `internal: true` (`isInternalTraffic`), so PostHog's
 *   test-account filter can drop it. A team device opts in once with `?internal=1`.
 */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || DEFAULT_APP_INGEST_HOST).replace(/\/+$/, '');

let on = false;
let started = false;
/** Device flag set by `?internal=1` (and cleared by `?internal=0`); survives restarts. */
const INTERNAL_KEY = 'antelope.analytics.internal';
let internal = builtInternal(false);

/** Internal from how and where this build runs, plus the device's stored opt-in. */
function builtInternal(stored: boolean): boolean {
  const web = Platform.OS === 'web';
  return isInternalTraffic({
    dev: __DEV__,
    web,
    host: web && typeof window !== 'undefined' ? window.location.host : undefined,
    productionHost: new URL(APP_ORIGIN).host,
    onDevice: Device.isDevice,
    stored,
  });
}

/** Applies a `?internal=` param, then reads the stored opt-in. Storage trouble leaves it unmarked. */
async function resolveInternal(param: '1' | '0' | undefined): Promise<boolean> {
  try {
    if (param === '1') await AsyncStorage.setItem(INTERNAL_KEY, '1');
    if (param === '0') await AsyncStorage.removeItem(INTERNAL_KEY);
    return builtInternal((await AsyncStorage.getItem(INTERNAL_KEY)) === '1');
  } catch {
    return builtInternal(false);
  }
}
/** The app was opened from a website guide: the first practice it starts is `source: 'guide'`. */
let guideLaunchPending = false;

function superProps(signedIn: boolean): Props {
  return {
    surface: 'app',
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    app_version: Constants.expoConfig?.version ?? 'unknown',
    signed_in: signedIn,
    internal,
  };
}

/** Starts PostHog once and sends `app_opened`. Call at module load, before the first screen. */
export function startAnalytics(): void {
  if (started || !KEY) return;
  started = true;
  on = client.start({ key: KEY, host: HOST, superProps: superProps(false) });
  if (!on) return;
  void client.launch().then(async ({ entry, src, internal: param }) => {
    if (entry === 'guide') guideLaunchPending = true;
    internal = await resolveInternal(param);
    client.register({ internal });
    // the person too, so their website visits (joined by the CTA bridge) drop out with the rest
    if (internal) client.setPerson({ internal: true });
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
  if (!on) return;
  client.reset(superProps(false));
  // the device is still internal; the fresh anonymous person has to say so too
  if (internal) client.setPerson({ internal: true });
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
