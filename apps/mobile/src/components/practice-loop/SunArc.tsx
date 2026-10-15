import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { color, layout } from '@/design';
import { FADE_MS, useReduceMotion } from '@/motion';

const H = 46;
/** The horizon: where the hills meet the sky, pt from the top. */
const HORIZON = 36;
const SUN = 14;
/** Before the rep is done the sun never sets: it waits low on the right. */
const WAIT_AT = 0.92;
/** Reduced motion: the sun steps (with a cross-fade) this often instead of gliding. */
const STEP_MS = 15_000;

/*
 * The daily rep's timer: a sun crosses a small landscape over the rep's two minutes and
 * sets when it's done. Not a countdown: if the rep runs long the sun just waits low on the
 * right, and it sets the moment the first rep is finished, early or late.
 *
 *   t 0..2min  the sun rises from the left horizon, arcs over, and descends (UI-thread
 *              timing, linear: one shared value; position is closed-form on the arc)
 *   DONE       the sun hurries along the rest of its arc (300ms), then SETS behind the
 *              hills (480ms, ease-in) as the sky warms to ochre and cools to dusk (~1.1s)
 *
 * Reduced motion: the sun steps along the arc every 15s with a cross-fade, and on done it
 * fades out as the dusk tint fades in.
 */
export function SunArc({ done, minutes = 2 }: { done: boolean; minutes?: number }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(300);
  const p = useSharedValue(0);
  const set = useSharedValue(0);
  const glow = useSharedValue(0);
  const shown = useSharedValue(1);

  // the day passes
  useEffect(() => {
    if (done) return;
    const total = minutes * 60_000;
    const started = Date.now() - p.value * total;
    if (!reduce) {
      p.value = withTiming(WAIT_AT, { duration: Math.max(0, (WAIT_AT - p.value) * total), easing: Easing.linear });
      return () => cancelAnimation(p);
    }
    const step = () => {
      const next = Math.min(WAIT_AT, (Date.now() - started) / total);
      shown.value = withSequence(
        withTiming(0, { duration: FADE_MS / 2 }, (f) => {
          if (f) p.value = next;
        }),
        withTiming(1, { duration: FADE_MS / 2 }),
      );
    };
    const id = setInterval(step, STEP_MS);
    return () => clearInterval(id);
  }, [done, reduce, minutes, p, shown]);

  // the rep is done: sunset
  useEffect(() => {
    if (!done) return;
    cancelAnimation(p);
    if (reduce) {
      shown.value = withTiming(0, { duration: FADE_MS });
      glow.value = withTiming(0.55, { duration: FADE_MS });
      set.value = withTiming(1, { duration: FADE_MS });
      return;
    }
    p.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    set.value = withSequence(withTiming(0, { duration: 300 }), withTiming(1, { duration: 480, easing: Easing.in(Easing.quad) }));
    glow.value = withSequence(withTiming(1, { duration: 520 }), withTiming(0.55, { duration: 560 }));
  }, [done, reduce, p, set, glow]);

  const r = (w - SUN * 2) / 2;
  const sun = useAnimatedStyle(() => {
    // rises at the left edge, peaks mid-way, sets at the right
    const a = Math.PI * (1 - p.value);
    const x = w / 2 + r * Math.cos(a) - SUN / 2;
    const y = HORIZON - (HORIZON - 6) * Math.sin(a) - SUN / 2 + set.value * (SUN + 4);
    return { opacity: shown.value, transform: [{ translateX: x }, { translateY: y }] };
  });
  const warm = useAnimatedStyle(() => ({ opacity: glow.value * (1 - 0.6 * set.value) }));
  const dusk = useAnimatedStyle(() => ({ opacity: set.value * 0.9 }));

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <View style={styles.scene} onLayout={(e) => setW(Math.max(120, e.nativeEvent.layout.width))}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dusk, dusk]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.warm, warm]} />
        <Svg width={w} height={H} style={StyleSheet.absoluteFill}>
          {/* the sun's path, faint */}
          <Path d={`M${SUN} ${HORIZON} A${r} ${HORIZON - 6} 0 0 1 ${w - SUN} ${HORIZON}`} stroke={color.primaryTint} strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round" fill="none" />
        </Svg>
        <Animated.View style={[styles.sun, sun]}>
          <View style={styles.sunHalo} />
          <View style={styles.sunCore} />
        </Animated.View>
        {/* the hills sit in front, so the sun sets behind them */}
        <Svg width={w} height={H} style={StyleSheet.absoluteFill}>
          <Path d={`M0 ${HORIZON + 2} Q${w * 0.22} ${HORIZON - 7} ${w * 0.45} ${HORIZON + 1} T${w} ${HORIZON - 2} V${H} H0 Z`} fill={color.softDeep} />
          <Path d={`M0 ${HORIZON + 6} Q${w * 0.3} ${HORIZON} ${w * 0.62} ${HORIZON + 5} T${w} ${HORIZON + 3} V${H} H0 Z`} fill={color.primaryTint} />
          <Circle cx={w * 0.7} cy={HORIZON - 1} r={2} fill={color.primaryTint} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.gutter, width: '100%', maxWidth: layout.maxWidth + layout.gutter * 2, alignSelf: 'center' },
  scene: { height: H, borderRadius: 12, overflow: 'hidden', backgroundColor: color.white },
  warm: { backgroundColor: color.goldTint },
  dusk: { backgroundColor: color.soft },
  sun: { position: 'absolute', left: 0, top: 0, width: SUN, height: SUN },
  sunHalo: { position: 'absolute', left: -6, top: -6, width: SUN + 12, height: SUN + 12, borderRadius: (SUN + 12) / 2, backgroundColor: color.gold, opacity: 0.22 },
  sunCore: { width: SUN, height: SUN, borderRadius: SUN / 2, backgroundColor: color.gold },
});
