import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SnowflakeIcon, color, radius } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';

const SIZE = 36;
const BAND = 14;

/*
 * Frost shimmer storyboard (a held freeze, each time Me comes into view). t = 0 is 450ms
 * after focus, plus 140ms per earlier held slot.
 *
 *   t 0     a pale frost band sweeps corner to corner across the slot, 620ms, ease-in-out
 *   t 260   the snowflake glints: 1 → 1.18 with a 30° turn, back on `bouncy`
 *   t ~760  rest
 *
 * An empty slot stays still. Reduced motion: a frost veil cross-fades in and out.
 */
const SHIMMER_AT = 450;
const SLOT_STAGGER = 140;

/** One of Me's streak-freeze slots. A held one shimmers with frost to say it's ready. */
export function FreezeSlot({ held, index }: { held: boolean; index: number }) {
  const reduce = useReduceMotion();
  const focused = useIsFocused();
  const sweep = useSharedValue(0);
  const glint = useSharedValue(0);

  useEffect(() => {
    if (!held || !focused) return;
    const at = SHIMMER_AT + index * SLOT_STAGGER;
    sweep.value = 0;
    if (reduce) {
      sweep.value = withDelay(at, withSequence(withTiming(1, { duration: FADE_MS }), withTiming(0, { duration: FADE_MS * 2 })));
    } else {
      sweep.value = withDelay(at, withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }));
      glint.value = withDelay(at + 260, withSequence(withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, spring.bouncy)));
    }
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(glint);
    };
  }, [held, focused, index, reduce, sweep, glint]);

  const band = useAnimatedStyle(() => {
    if (reduce) return { opacity: 0 };
    const p = sweep.value;
    return { opacity: p > 0 && p < 1 ? 1 : 0, transform: [{ translateX: -SIZE + p * SIZE * 2.2 }, { rotate: '25deg' }] };
  });
  const veil = useAnimatedStyle(() => ({ opacity: reduce ? sweep.value * 0.75 : 0 }));
  const flake = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.18 * glint.value }, { rotate: `${30 * glint.value}deg` }] }));

  return (
    <View style={[styles.slot, held && styles.held]}>
      <Animated.View style={flake}>
        <SnowflakeIcon size={20} weight="bold" color={held ? color.primary : color.faint} />
      </Animated.View>
      {held ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.band, band]} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veil]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
    borderWidth: 2,
    borderColor: color.line,
    overflow: 'hidden',
  },
  held: { backgroundColor: color.soft, borderColor: color.primaryTint },
  band: { position: 'absolute', top: -SIZE / 2, left: 0, width: BAND, height: SIZE * 2, backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  veil: { backgroundColor: color.white },
});
