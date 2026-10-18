import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { color, haptic } from '@/design';
import { spring, useReduceMotion } from '@/motion';

/** viewBox units; the clock is drawn on a 72 x 72 grid and scaled to `size`. */
const VB = 72;
const CX = 36;
const CY = 41;

/** `${v}deg` would print tiny values as "1e-7deg" and drop the transform. */
function deg(v: number) {
  'worklet';
  return `${v.toFixed(3)}deg`;
}

/** Hour hand angle (clockwise from 12) for a time, unwrapped toward `from` so it turns the short way. */
function nearest(target: number, from: number) {
  return target + 360 * Math.round((from - target) / 360);
}

/**
 * The reminder offer's alarm clock. Its hands sweep to the time being picked; when reminders
 * turn on it rings: a fast shake with ring lines and a tick on each bell strike, then settles.
 * Reduced motion: hands jump, no shake, the ring lines just show.
 */
export function AlarmClock({ hour, minute, ringing, size = 72 }: { hour: number; minute: number; ringing: boolean; size?: number }) {
  const reduce = useReduceMotion();
  const s = size / VB;
  const hourA = useSharedValue(((hour % 12) + minute / 60) * 30);
  const minA = useSharedValue(minute * 6);
  const shake = useSharedValue(0);
  const lift = useSharedValue(0);
  const ring = useSharedValue(0);

  // the hands follow the picked time
  useEffect(() => {
    const h = nearest(((hour % 12) + minute / 60) * 30, hourA.value);
    const m = nearest(minute * 6, minA.value);
    if (reduce) {
      hourA.value = h;
      minA.value = m;
      return;
    }
    hourA.value = withSpring(h, spring.gentle);
    minA.value = withSpring(m, spring.gentle);
  }, [hour, minute, reduce, hourA, minA]);

  // ring once when reminders turn on
  const rung = useRef(false);
  useEffect(() => {
    if (!ringing || rung.current) return;
    rung.current = true;
    if (reduce) {
      ring.value = 1;
      return;
    }
    const STRIKE = 46;
    const STRIKES = 12;
    shake.value = withSequence(
      withRepeat(withSequence(withTiming(11, { duration: STRIKE / 2 }), withTiming(-11, { duration: STRIKE })), STRIKES / 2, true),
      withSpring(0, spring.bouncy),
    );
    lift.value = withSequence(withTiming(-3, { duration: 90, easing: Easing.out(Easing.quad) }), withDelay(STRIKE * STRIKES - 90, withSpring(0, spring.bouncy)));
    ring.value = withSequence(withTiming(1, { duration: 120 }), withDelay(STRIKE * STRIKES, withTiming(0, { duration: 260 })));
    // a tick on every other strike: a rattle, not a buzz
    let n = 0;
    const iv = setInterval(() => {
      haptic.tick();
      n += 1;
      if (n >= STRIKES / 2) clearInterval(iv);
    }, STRIKE * 2);
    return () => clearInterval(iv);
  }, [ringing, reduce, shake, lift, ring]);

  const body = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value * s }, { rotate: deg(shake.value) }] }));
  const lines = useAnimatedStyle(() => ({ opacity: ring.value, transform: [{ scale: 0.7 + 0.3 * ring.value }] }));

  // a hand pivots on the clock's centre: move the pivot to its own centre, turn, move back
  // (half its length, worked out here: the style worklets can't call back into JS)
  const hourD = (11 * s) / 2;
  const minD = (16 * s) / 2;
  const hourStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hourD }, { rotate: deg(hourA.value) }, { translateY: -hourD }],
  }));
  const minStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: minD }, { rotate: deg(minA.value) }, { translateY: -minD }],
  }));
  const handBox = (len: number, w: number) => ({
    position: 'absolute' as const,
    left: (CX - w / 2) * s,
    top: (CY - len) * s,
    width: w * s,
    height: len * s,
    borderRadius: (w / 2) * s,
    backgroundColor: color.navy,
  });

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, lines]} pointerEvents="none">
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          {/* ring lines either side of the bells */}
          <Path d="M8 22 L2 18 M7 30 L0 30 M9 38 L3 41" stroke={color.gold} strokeWidth={3} strokeLinecap="round" />
          <Path d="M64 22 L70 18 M65 30 L72 30 M63 38 L69 41" stroke={color.gold} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, body]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          {/* legs */}
          <Path d="M22 62 L17 69 M50 62 L55 69" stroke={color.navy} strokeWidth={3.5} strokeLinecap="round" />
          {/* bells and the hammer between them */}
          <Path d="M12 22 A10.5 10.5 0 0 1 28 8 Z" fill={color.gold} stroke={color.navy} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M60 22 A10.5 10.5 0 0 0 44 8 Z" fill={color.gold} stroke={color.navy} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M36 15 L36 8 M31 8 L41 8" stroke={color.navy} strokeWidth={3} strokeLinecap="round" />
          {/* face */}
          <Circle cx={CX} cy={CY} r={25} fill={color.white} stroke={color.navy} strokeWidth={3.5} />
          <Circle cx={CX} cy={CY} r={19} fill={color.soft} />
          <Path d="M36 22 L36 25.5 M55 41 L51.5 41 M36 60 L36 56.5 M17 41 L20.5 41" stroke={color.primary} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
        <Animated.View style={[handBox(16, 2.6), minStyle]} />
        <Animated.View style={[handBox(11, 3.6), hourStyle]} />
        <View
          style={{
            position: 'absolute',
            left: (CX - 2.6) * s,
            top: (CY - 2.6) * s,
            width: 5.2 * s,
            height: 5.2 * s,
            borderRadius: 2.6 * s,
            backgroundColor: color.gold,
          }}
        />
      </Animated.View>
    </View>
  );
}
