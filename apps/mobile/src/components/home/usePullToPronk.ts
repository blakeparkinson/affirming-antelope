import { useCallback, useRef, type RefObject } from 'react';
import { Platform } from 'react-native';
import { Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { MascotHandle } from '@/components/mascot';
import { PRONK_MS } from '@/components/mascot/choreo';
import { haptic } from '@/design';

/** How far (pt) past the top Home has to be pulled for the antelope to pronk on release. */
export const PULL_TO_PRONK = 72;

/** One pronk at a time, shared by every way of starting one on Home (pull, triple tap). */
export function usePronkGate(coach: RefObject<MascotHandle | null>) {
  const busyUntil = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now < busyUntil.current) return false;
    busyUntil.current = now + PRONK_MS;
    coach.current?.pronk({ onLand: haptic.thud });
    return true;
  }, [coach]);
}

/**
 * Pull Home down and the antelope crouches with the pull, ticks when the pull is far enough,
 * and pronks when you let go (with a thud on the landing). iOS only: the pull is the scroll
 * view's overscroll, which Android and the web don't have; there, a signed-in refresh pronks
 * instead (see `onRefreshPronk`). Reduced motion: no crouch, no pronk.
 *
 * `scrollY` is the scroll offset (negative while overscrolled); call `released(y)` from the
 * scroll handler's onEndDrag with the offset at release.
 */
export function usePullToPronk(scrollY: SharedValue<number>, pronk: () => boolean, reduce: boolean) {
  const supported = Platform.OS === 'ios' && !reduce;

  useAnimatedReaction(
    () => supported && -scrollY.value >= PULL_TO_PRONK,
    (armed, was) => {
      if (armed && was === false) scheduleOnRN(haptic.tick);
    },
  );

  // squash toward the feet as the pull builds, like a spring being loaded
  const crouch = useAnimatedStyle(() => {
    if (!supported) return {};
    const k = interpolate(-scrollY.value, [0, PULL_TO_PRONK], [0, 1], Extrapolation.CLAMP);
    const sy = 1 - 0.1 * k;
    return { transform: [{ scaleX: 1 / Math.sqrt(sy) }, { scaleY: sy }] };
  });

  const onRelease = useCallback(() => {
    if (supported) pronk();
  }, [supported, pronk]);

  /** Worklet: the offset at the end of a drag. */
  const released = (y: number) => {
    'worklet';
    if (-y >= PULL_TO_PRONK) scheduleOnRN(onRelease);
  };

  /** A refresh started by RefreshControl: pronk where the pull itself can't (Android). */
  const onRefreshPronk = useCallback(() => {
    if (Platform.OS !== 'ios' && !reduce) pronk();
  }, [reduce, pronk]);

  return { crouch, released, onRefreshPronk };
}
