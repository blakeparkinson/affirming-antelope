import { stanceVisual, type Stance } from '@antelope/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { color, haptic, warmth as palette } from '@/design';
import { Burst, spring, useReduceMotion, type BurstHandle } from '@/motion';

/*
 * The person you're talking to, opening up or closing down (warmth.ts).
 *
 *   change      leans in (scale 1.08, rises 1.5pt, head tilts 3°), the face warms (apricot wash) and a
 *               soft glow blooms behind them and breathes (1.8s)
 *   ambivalent  at rest, a slow sway either side (2.5°, 3.4s a cycle)
 *   sustain     sits back (scale 0.95, drops 1.5pt), the face cools a little
 *   discord     a quick recoil on the line (80ms flinch back, then a gentle settle and a shiver),
 *               shoulders drawn in (scaleX 0.94), the coolest wash
 *   neutral     (unknown or missing stance) at rest, untinted
 *
 * Every pose is a spring on the UI thread, so a change mid-move carries its velocity.
 * The header's warmth thread eases its colour over 900ms and a highlight carries the
 * new colour out from the portrait to both ends. The first time they open up in a
 * conversation: a light haptic and a small spark. Reduced motion: colour cross-fades only.
 */

/** Warmth (-1..1) to the thread's colour. */
export function warmthColor(w: number): string {
  'worklet';
  return interpolateColor(w, [-1, -0.5, 0, 1], [palette.cold, palette.cool, palette.rest, palette.warm]);
}

const EASE = Easing.inOut(Easing.cubic);
const SWAY = Easing.inOut(Easing.sin);

/** The conversation's warmth, eased between lines. One value tints the portrait and colours the thread. */
export function useWarmth(stance?: Stance): SharedValue<number> {
  const target = stanceVisual(stance).warmth;
  const w = useSharedValue(target);
  useEffect(() => {
    w.value = withTiming(target, { duration: 900, easing: EASE });
  }, [target, w]);
  return w;
}

const SPARK_COLORS = [palette.warm, palette.glow, color.gold, palette.warm, color.goldTint];

export function PersonaPresence({
  stance,
  line,
  warmth,
  size,
  spark,
  children,
}: {
  stance?: Stance;
  /** The line they're saying now: a recoil plays once per line. */
  line?: string;
  warmth: SharedValue<number>;
  size: number;
  /** Turns true once, the first time they open up: haptic + spark. */
  spark?: boolean;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const v = stanceVisual(stance);
  const scale = useSharedValue(reduce ? 1 : v.scale);
  const lift = useSharedValue(reduce ? 0 : v.lift);
  const tilt = useSharedValue(reduce ? 0 : v.tilt);
  const squeeze = useSharedValue(reduce ? 1 : v.squeeze);
  const sway = useSharedValue(0);
  const kick = useSharedValue(0);
  const shiver = useSharedValue(0);
  const glow = useSharedValue(v.glow);
  const breathe = useSharedValue(0);
  const burst = useRef<BurstHandle>(null);

  useEffect(() => {
    glow.value = withTiming(v.glow, { duration: 700, easing: EASE });
    if (reduce) {
      cancelAnimation(sway);
      cancelAnimation(breathe);
      sway.value = 0;
      breathe.value = 0;
      scale.value = 1;
      lift.value = 0;
      tilt.value = 0;
      squeeze.value = 1;
      return;
    }
    scale.value = withSpring(v.scale, spring.gentle);
    lift.value = withSpring(v.lift, spring.gentle);
    tilt.value = withSpring(v.tilt, spring.gentle);
    squeeze.value = withSpring(v.squeeze, spring.gentle);
    if (v.sway) {
      sway.value = withRepeat(
        withSequence(withTiming(v.sway, { duration: 1700, easing: SWAY }), withTiming(-v.sway, { duration: 1700, easing: SWAY })),
        -1,
      );
    } else {
      cancelAnimation(sway);
      sway.value = withSpring(0, spring.gentle);
    }
    if (v.glow) breathe.value = withRepeat(withTiming(1, { duration: 1800, easing: SWAY }), -1, true);
    else {
      cancelAnimation(breathe);
      breathe.value = withTiming(0, { duration: 400 });
    }
  }, [v, reduce, scale, lift, tilt, squeeze, sway, glow, breathe]);

  // the flinch lands with the line itself, every time they push back
  useEffect(() => {
    if (reduce || !v.recoil) return;
    kick.value = withSequence(withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) }), withSpring(0, spring.gentle));
    shiver.value = withDelay(
      140,
      withSequence(withTiming(1.2, { duration: 45 }), withTiming(-1.2, { duration: 60 }), withTiming(0.8, { duration: 60 }), withTiming(0, { duration: 70 })),
    );
  }, [line, v.recoil, reduce, kick, shiver]);

  const sparked = useRef(false);
  useEffect(() => {
    if (!spark || sparked.current) return;
    sparked.current = true;
    haptic.press();
    burst.current?.fire();
  }, [spark]);

  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value + kick.value * 1.5 },
      { translateX: shiver.value },
      { rotate: `${tilt.value + sway.value - kick.value * 5}deg` },
      { scale: scale.value - kick.value * 0.07 },
      { scaleX: squeeze.value },
    ],
  }));
  const wash = useAnimatedStyle(() => {
    const w = warmth.value;
    return {
      backgroundColor: interpolateColor(w, [-1, -0.01, 0.01, 1], [palette.cold, palette.cold, palette.warm, palette.warm]),
      opacity: Math.min(1, Math.abs(w)) * 0.22,
    };
  });
  const halo = useAnimatedStyle(() => ({
    opacity: glow.value * (0.5 + 0.2 * breathe.value),
    transform: [{ scale: reduce ? 1 : 0.75 + 0.25 * glow.value + 0.06 * breathe.value }],
  }));

  const g = size * 1.5;
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, { width: g, height: g, borderRadius: g / 2, left: (size - g) / 2, top: (size - g) / 2 }, styles.glow, halo]}
      />
      <Animated.View style={body}>
        {children}
        <Animated.View pointerEvents="none" style={[styles.abs, { width: size, height: size, borderRadius: size / 2 }, wash]} />
      </Animated.View>
      <Burst ref={burst} count={10} power={0.42} scale={0.7} spread={180} duration={620} colors={SPARK_COLORS} />
    </View>
  );
}

/**
 * The thin warmth thread along the bottom of the header. At rest it's the chrome's own
 * rule; it warms to apricot or cools to slate with the conversation, and when it moves,
 * a highlight in the new colour runs out from the portrait to both ends.
 */
export function WarmthThread({ warmth, stance }: { warmth: SharedValue<number>; stance?: Stance }) {
  const reduce = useReduceMotion();
  const target = stanceVisual(stance).warmth;
  const [width, setWidth] = useState(0);
  const run = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    run.value = 0;
    run.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [target, reduce, run]);

  const thread = useAnimatedStyle(() => ({
    backgroundColor: warmthColor(warmth.value),
    opacity: 0.7 + 0.3 * Math.min(1, Math.abs(warmth.value)),
  }));
  const half = width / 2;
  const left = useAnimatedStyle(() => ({
    opacity: run.value >= 1 ? 0 : (1 - run.value) * 0.95,
    transform: [{ translateX: -run.value * (half - HL / 2) }, { scaleX: 1 + run.value }],
  }));
  const right = useAnimatedStyle(() => ({
    opacity: run.value >= 1 ? 0 : (1 - run.value) * 0.95,
    transform: [{ translateX: run.value * (half - HL / 2) }, { scaleX: 1 + run.value }],
  }));
  const tint = warmthColor(target);

  return (
    <View pointerEvents="none" style={styles.threadWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.thread, thread]} />
      {width && !reduce ? (
        <>
          <Animated.View style={[styles.highlight, { left: half - HL / 2, backgroundColor: tint }, left]} />
          <Animated.View style={[styles.highlight, { left: half - HL / 2, backgroundColor: tint }, right]} />
        </>
      ) : null}
    </View>
  );
}

const HL = 44;

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  glow: { backgroundColor: palette.glow },
  threadWrap: { height: 3, justifyContent: 'center' },
  thread: { height: 3, borderRadius: 1.5 },
  highlight: { position: 'absolute', top: 0, width: HL, height: 3, borderRadius: 1.5 },
});
