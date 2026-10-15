import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BrandSplash } from '@/components/brand/BrandSplash';
import { useBrandFonts } from '@/design/fonts';
import { screenView, startAnalytics } from '@/lib/analytics';
import { onReminderOpened, startReminders } from '@/lib/reminders';
import { color } from '@/design/tokens';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
// reads the launch URL's `src` (track preselect) before the router normalises it
import '@/lib/launchHint';
import { useAccount } from '@/state/account';
import { useLearner } from '@/state/store';
import { startSync } from '@/sync/engine';

startAnalytics(); // first: reads the website's ph_did/ph_sid from the URL before the router normalises it
SplashScreen.preventAutoHideAsync().catch(() => {});
// accounts + sync: guest mode and offline keep working whether or not this ever reaches a server
startSync();
// practice reminders: re-planned on every practice, setting change, sign-out and foreground
startReminders();
onReminderOpened();

const SESSION = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

function useHydrated() {
  const [done, setDone] = useState(() => useLearner.persist.hasHydrated());
  useEffect(() => {
    if (done) return;
    const unsub = useLearner.persist.onFinishHydration(() => setDone(true));
    if (useLearner.persist.hasHydrated()) setDone(true);
    return unsub;
  }, [done]);
  // the welcome-or-Home decision is made once the account cache and auth session are read
  const onboarded = useAccount((s) => s.onboarded);
  return done && onboarded !== null;
}

const SHEET = { presentation: 'modal', gestureEnabled: true, contentStyle: { backgroundColor: color.white } } as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useBrandFonts();
  const hydrated = useHydrated();
  const pathname = usePathname();
  useEffect(() => screenView(pathname), [pathname]);
  const ready = (fontsLoaded || !!fontError) && hydrated;
  // in once the welcome is done and a track is picked (an old demo seed reset to fresh still needs one)
  const welcomed = useAccount((s) => s.onboarded) === true;
  const tracked = useLearner((s) => s.pathwayChosenAt !== null);
  const onboarded = welcomed && tracked;
  const reduce = useReduceMotion();
  const [splashGone, setSplashGone] = useState(false);
  const rise = useSharedValue(0);

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    rise.value = reduce ? 1 : withSpring(1, spring.gentle);
  }, [ready, reduce, rise]);

  const onSplashDone = useCallback(() => setSplashGone(true), []);
  const app = useAnimatedStyle(() => ({ transform: [{ scale: 0.97 + 0.03 * rise.value }] }));

  if (!ready) return <View style={styles.root} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <Animated.View style={[styles.root, app]}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.white } }}>
          <Stack.Protected guard={onboarded}>
            {/* fades in when the welcome hands over on first launch */}
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            {/* Practice screens: transparent modals with no native animation. SessionSurface owns the
                transition (container transform from the source, swipe-down dismiss, collapse on close). */}
            <Stack.Screen name="drill/[id]" options={SESSION} />
            <Stack.Screen name="roleplay/[scenarioId]" options={SESSION} />
            <Stack.Screen name="lesson/[id]" options={SESSION} />
            <Stack.Screen name="review/[id]" />
            <Stack.Screen name="join" options={SHEET} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          </Stack.Protected>
          {/* reachable from the welcome, Me, Home and the review sheet */}
          <Stack.Screen name="sign-in" options={SHEET} />
        </Stack>
      </Animated.View>
      {!splashGone && <BrandSplash reduce={reduce} onDone={onSplashDone} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.white } });
