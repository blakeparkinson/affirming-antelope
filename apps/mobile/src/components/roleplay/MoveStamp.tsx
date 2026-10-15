import type { MoveTier } from '@antelope/core';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MoveMarker } from '@/components/practice-loop/MoveMarker';
import type { MoveFamily } from '@/components/practice-loop/moves';
import { color, haptic, moveColor, radius } from '@/design';
import { Burst, FADE_MS, useReduceMotion, type BurstHandle } from '@/motion';

/*
 * The learner's move, pinned to their own bubble as it happens (liveMoves.ts).
 *
 *   t 0      the marker scales up from nothing on a spring that overshoots ~20% and settles
 *            by ~350ms; a quick 70ms fade covers the first frames
 *   t 90     at the overshoot: a light haptic, and a soft highlight sweeps once across the
 *            bubble (650ms, ease-out)
 *   strong   the same, bigger: a bouncier spring, a medium haptic, a small burst in the
 *            move's colour from the marker, and `onStrong` (the persona's glow pulses once)
 *   weak     the neutral dot settles in without overshoot: no haptic, no sweep
 *   quiet    a marker that was already there (a remount): it pops, but nothing else
 *
 * `at` is when to pop (Date.now() clock), so markers that arrive together stagger.
 * Reduced motion: the marker fades in; nothing moves and nothing bursts.
 */

export interface Stamp {
  family: MoveFamily;
  tier: MoveTier;
  /** When it pops, ms since epoch. */
  at: number;
  /** Already on the bubble before this screen mounted: no haptic, burst or sweep. */
  quiet?: boolean;
}

const SIZE = 20;
const PEAK_MS = 90;
const POP = { damping: 13, stiffness: 380, mass: 0.6 };
const POP_STRONG = { damping: 10, stiffness: 340, mass: 0.6 };
const SETTLE = { damping: 26, stiffness: 300, mass: 0.7 };

/** The marker, hanging off the bubble's bottom-left corner. */
export function MoveStamp({ stamp, onPeak }: { stamp: Stamp; onPeak?: (tier: MoveTier) => void }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  const o = useSharedValue(0);
  const burst = useRef<BurstHandle>(null);
  const peak = useRef(onPeak);
  peak.current = onPeak;

  useEffect(() => {
    const { tier, quiet } = stamp;
    const wait = Math.max(0, stamp.at - Date.now());
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        if (reduce) {
          o.value = withTiming(1, { duration: FADE_MS });
          return;
        }
        o.value = withTiming(1, { duration: 70 });
        s.value = withSpring(1, tier === 'weak' ? SETTLE : tier === 'strong' ? POP_STRONG : POP);
      }, wait),
    );
    if (!quiet && tier !== 'weak') {
      timers.push(
        setTimeout(() => {
          if (tier === 'strong') {
            haptic.thud();
            burst.current?.fire();
          } else haptic.press();
          peak.current?.(tier);
        }, wait + (reduce ? 0 : PEAK_MS)),
      );
    }
    return () => timers.forEach(clearTimeout);
    // a stamp pops once, when it first mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  const tint = moveColor[stamp.family];
  return (
    <View pointerEvents="none" style={styles.anchor} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[styles.marker, style]}>
        <MoveMarker family={stamp.family} size={SIZE} />
      </Animated.View>
      {stamp.tier === 'strong' ? <Burst ref={burst} count={10} power={0.3} scale={0.7} spread={180} duration={560} colors={[tint, tint, tint, color.gold]} /> : null}
    </View>
  );
}

const BAND = 90;
const SHEEN = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.26)', 'rgba(255,255,255,0)'] as const;

/**
 * A soft highlight that sweeps once across the bubble. Lives inside the bubble and clips to it.
 * `play` flips true on the marker's peak. Reduced motion: never drawn.
 */
export function BubbleSheen({ play }: { play: boolean }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!play || reduce || !w) return;
    x.value = 0;
    x.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [play, reduce, w, x]);
  const band = useAnimatedStyle(() => ({
    opacity: x.value > 0 && x.value < 1 ? 1 : 0,
    transform: [{ translateX: -BAND + x.value * (w + BAND) }],
  }));
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={styles.sheenClip} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.band, band]}>
        <LinearGradient colors={SHEEN} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // straddles the bottom edge just inside the rounded corner, so it reads as pinned to the bubble
  anchor: { position: 'absolute', left: 10, bottom: -SIZE / 2 - 1, width: SIZE, height: SIZE, zIndex: 3 },
  marker: { width: SIZE, height: SIZE },
  sheenClip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: radius.surface,
    borderBottomRightRadius: 6,
  },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, width: BAND },
});
