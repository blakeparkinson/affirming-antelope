import { INTERNAL_PARAM, internalParam } from '@antelope/core';
import posthog from 'posthog-js';
import type { AnalyticsClient, LaunchContext, Props } from './analyticsTypes';

/**
 * Web (app.affirmingantelope.com): posthog-js, so a visitor who clicked a CTA on the
 * website continues as the same person. The CTA link carries `ph_did` (anonymous id) and
 * `ph_sid` (session id); we bootstrap PostHog with them and strip them from the URL.
 */

let launch: LaunchContext = { entry: 'direct' };

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || win.doNotTrack === '1' || nav.msDoNotTrack === '1';
}

/** Reads `ph_did`, `ph_sid`, `src`, `internal` once, removes all but `src` from the address bar. */
function readBridge(): { did?: string; sid?: string; src?: string; internal?: '1' | '0' } {
  const url = new URL(window.location.href);
  const did = url.searchParams.get('ph_did') ?? undefined;
  const sid = url.searchParams.get('ph_sid') ?? undefined;
  const src = url.searchParams.get('src') ?? undefined;
  const internal = internalParam(url.searchParams.get(INTERNAL_PARAM));
  if (did || sid || url.searchParams.has(INTERNAL_PARAM)) {
    url.searchParams.delete('ph_did');
    url.searchParams.delete('ph_sid');
    url.searchParams.delete(INTERNAL_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  // Only accept sane values: id-shaped strings, short slugs.
  const safe = (v: string | undefined, re: RegExp) => (v && re.test(v) ? v : undefined);
  return { did: safe(did, /^[0-9a-zA-Z_-]{8,64}$/), sid: safe(sid, /^[0-9a-fA-F-]{8,64}$/), src: safe(src, /^[a-z0-9_-]{1,64}$/i), internal };
}

function entryFor(b: { did?: string; src?: string; internal?: '1' | '0' }): LaunchContext {
  const src = b.src;
  const internal = b.internal ? { internal: b.internal } : {};
  if (src?.startsWith('guide_')) return { entry: 'guide', src, ...internal };
  if (b.did || src) return { entry: 'website_cta', ...(src ? { src } : {}), ...internal };
  // Landed somewhere other than the front door: a shared link into a screen.
  const path = window.location.pathname;
  return { entry: path !== '/' && path !== '' ? 'deep_link' : 'direct', ...internal };
}

export const client: AnalyticsClient = {
  start({ key, host, superProps }) {
    if (typeof window === 'undefined' || optedOut()) return false;
    const bridge = readBridge();
    launch = entryFor(bridge);
    try {
      posthog.init(key, {
        api_host: host,
        ui_host: 'https://us.posthog.com',
        person_profiles: 'identified_only',
        persistence: 'localStorage',
        cross_subdomain_cookie: false,
        respect_dnt: true,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_exceptions: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        // The router can re-read the landing URL after we strip the bridge params; never let them
        // ride along on an event.
        before_send: (event) => {
          if (event?.properties) {
            for (const key of ['$current_url', '$referrer']) {
              const v = event.properties[key];
              if (typeof v !== 'string' || !v.includes('ph_')) continue;
              try {
                const u = new URL(v);
                u.searchParams.delete('ph_did');
                u.searchParams.delete('ph_sid');
                event.properties[key] = u.toString();
              } catch {
                // not a URL: leave it
              }
            }
          }
          return event;
        },
        // Only used when this browser has no id yet; a returning learner keeps their own.
        ...(bridge.did ? { bootstrap: { distinctID: bridge.did, ...(bridge.sid ? { sessionID: bridge.sid } : {}) } } : {}),
      });
      // A returning learner is already identified (persisted): don't stamp the first events of
      // the session `signed_in: false`.
      const identified = posthog.get_property('$user_state') === 'identified';
      posthog.register(identified ? { ...superProps, signed_in: true } : superProps);
      return true;
    } catch {
      return false;
    }
  },
  launch: async () => launch,
  capture: (name, props) => void posthog.capture(name, props),
  // expo-router calls this from an effect, a beat before `window.location` catches up with the new
  // route, so the SDK's own `$current_url` would be the previous screen. State the path ourselves
  // (pathname only: ids, no query string).
  screen: (path) => void posthog.capture('$pageview', { $current_url: `${window.location.origin}${path}` }),
  identify: (id, person) => posthog.identify(id, person),
  setPerson: (person) => posthog.setPersonProperties(person),
  register: (props: Props) => posthog.register(props),
  reset: (superProps) => {
    posthog.reset();
    posthog.register(superProps);
  },
};
