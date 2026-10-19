import type { AppEntry } from '@antelope/core';

export type PropValue = string | number | boolean | string[];
export type Props = Record<string, PropValue>;

/** How this launch began, for `app_opened`. */
export interface LaunchContext {
  entry: AppEntry;
  src?: string;
  /** `?internal=1` marks this device as internal, `?internal=0` unmarks it (see `isInternalTraffic`). */
  internal?: '1' | '0';
}

/**
 * What a platform must provide. `analyticsClient.web.ts` wraps posthog-js (so the
 * website's anonymous id and session id can be bootstrapped from the URL) and
 * `analyticsClient.native.ts` wraps posthog-react-native. `analytics.ts` is the one
 * place the app talks to, and adds the privacy scrub, env and super properties.
 */
export interface AnalyticsClient {
  /** Returns false when analytics must stay off (opt-out signals, init failure). */
  start(config: { key: string; host: string; superProps: Props }): boolean;
  /** Resolves how the app was opened. Web reads (and strips) the website's bridge params. */
  launch(): Promise<LaunchContext>;
  capture(name: string, props?: Props): void;
  /** `$pageview` on web, `$screen` on native. `path` is a route pathname: ids only. */
  screen(path: string): void;
  identify(userId: string, person?: Props): void;
  setPerson(person: Props): void;
  register(props: Props): void;
  reset(superProps: Props): void;
}
