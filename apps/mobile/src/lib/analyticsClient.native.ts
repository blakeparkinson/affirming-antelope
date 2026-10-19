import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { INTERNAL_PARAM, internalParam } from '@antelope/core';
import PostHog from 'posthog-react-native';
import type { AnalyticsClient, LaunchContext } from './analyticsTypes';

/**
 * iOS / Android: posthog-react-native, created directly (no <PostHogProvider>), which
 * keeps touch autocapture off. We send our own typed events and `$screen` views only.
 * The anonymous id persists in AsyncStorage.
 */

let ph: PostHog | null = null;

export const client: AnalyticsClient = {
  start({ key, host, superProps }) {
    try {
      ph = new PostHog(key, {
        host,
        persistence: 'file',
        customStorage: AsyncStorage,
        captureAppLifecycleEvents: false,
        enableSessionReplay: false,
        preloadFeatureFlags: false,
        flushAt: 10,
      });
      void ph.register(superProps);
      return true;
    } catch {
      return false;
    }
  },
  async launch(): Promise<LaunchContext> {
    // A plain launch has no URL (or Expo's own dev URL, which has no path).
    try {
      const url = await Linking.getInitialURL();
      if (!url) return { entry: 'direct' };
      const parsed = Linking.parse(url);
      const raw = parsed.queryParams?.src;
      const src = typeof raw === 'string' && /^[a-z0-9_-]{1,64}$/i.test(raw) ? raw : undefined;
      const flag = internalParam(parsed.queryParams?.[INTERNAL_PARAM]);
      const internal = flag ? { internal: flag } : {};
      if (src?.startsWith('guide_')) return { entry: 'guide', src, ...internal };
      if (src) return { entry: 'website_cta', src, ...internal };
      return { entry: parsed.path ? 'deep_link' : 'direct', ...internal };
    } catch {
      return { entry: 'direct' };
    }
  },
  capture: (name, props) => ph?.capture(name, props),
  screen: (path) => void ph?.screen(path),
  identify: (id, person) => ph?.identify(id, person),
  setPerson: (person) => ph?.setPersonProperties(person),
  register: (props) => void ph?.register(props),
  reset: (superProps) => {
    ph?.reset();
    void ph?.register(superProps);
  },
};
