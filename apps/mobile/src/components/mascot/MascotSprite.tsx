import { Image } from 'expo-image';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { runPronk, runShiver } from './choreo';
import { CELEBRATE, HEAD, WAVE, type Frame } from './rig.generated';
import type { MascotHandle, MascotPose, MascotProps } from './types';

type Art = {
  width: number;
  height: number;
  base: number;
  /** Shift applied to shared frames (the head pose is a crop of the wave art). */
  offset: { x: number; y: number };
  blink: readonly { src: number; frame: Frame }[];
  arm?: typeof WAVE.arm;
  /** Where the feet are, as a fraction of height: breathing and squash anchor here. */
  anchorY: number;
};

const ART: Record<MascotPose, Art> = {
  wave: { width: WAVE.width, height: WAVE.height, base: WAVE.base, offset: { x: 0, y: 0 }, blink: WAVE.blink, arm: WAVE.arm, anchorY: 0.97 },
  celebrate: { width: CELEBRATE.width, height: CELEBRATE.height, base: CELEBRATE.base, offset: { x: 0, y: 0 }, blink: CELEBRATE.blink, anchorY: 0.96 },
  head: { width: HEAD.width, height: HEAD.height, base: HEAD.base, offset: HEAD.offset, blink: WAVE.blink, anchorY: 1 },
};

/** Clockwise degrees: the raised arm swings in toward the face. */
const WAVE_IN = 15;
const WAVE_OUT = 2;
const swing = { duration: 230, dampingRatio: 0.62 } as const;

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export const MascotSprite = forwardRef<MascotHandle, MascotProps>(function MascotSprite(
  { pose = 'wave', mood = 'idle', size, greet = false, paused = false, flip = false, accessibilityLabel, style },
  ref,
) {
  const reduce = useReduceMotion();
  const appActive = useAppActive();
  const live = appActive && !paused;

  // The pose on screen lags the prop during a squash so the swap happens at the bottom of it.
  const [shown, setShown] = useState<MascotPose>(pose);
  const art = ART[shown];
  const s = size / art.height;

  const breath = useSharedValue(0);
  const blink = useSharedValue(0);
  const arm = useSharedValue(0);
  const squash = useSharedValue(1);
  const lift = useSharedValue(0);
  const lean = useSharedValue(0);
  const turnX = useSharedValue(1);
  const fade = useSharedValue(1);
  const shake = useSharedValue(0);

  // ---- breathing: a slow sine, anchored at the feet. Paused off-screen.
  useEffect(() => {
    if (!live || reduce) {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
      return;
    }
    const period = mood === 'listening' ? 2300 : mood === 'cheer' ? 1200 : 1800;
    breath.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [live, reduce, mood, breath]);

  // ---- mood posture
  useEffect(() => {
    lean.value = reduce ? 0 : withSpring(mood === 'listening' ? 2.5 : mood === 'thinking' ? -2 : 0, spring.gentle);
  }, [mood, reduce, lean]);

  // ---- blinks: randomised, occasional double. A scheduler, not a frame loop.
  useEffect(() => {
    if (!live) return;
    let t: ReturnType<typeof setTimeout>;
    const once = () =>
      withSequence(
        withTiming(1, { duration: 75, easing: Easing.in(Easing.quad) }),
        withTiming(1, { duration: 45 }),
        withTiming(0, { duration: 130, easing: Easing.out(Easing.quad) }),
      );
    const next = () => {
      const base = mood === 'listening' ? 3800 : mood === 'cheer' ? 4200 : 2600;
      t = setTimeout(() => {
        const double = Math.random() < 0.22;
        blink.value = double ? withSequence(once(), withDelay(70, once())) : once();
        next();
      }, base + Math.random() * 2600);
    };
    next();
    return () => clearTimeout(t);
  }, [live, mood, blink]);

  const doWave = useCallback(() => {
    if (reduce) return;
    if (ART[shown].arm) {
      arm.value = withSequence(
        withSpring(WAVE_IN, swing),
        withSpring(WAVE_OUT, swing),
        withSpring(WAVE_IN, swing),
        withSpring(WAVE_OUT, swing),
        withSpring(WAVE_IN * 0.8, swing),
        withSpring(0, spring.gentle),
      );
      lean.value = withSequence(withSpring(-1.6, spring.gentle), withDelay(700, withSpring(0, spring.gentle)));
    } else {
      // no arm rig on this pose: a nod-hop says hello instead
      squash.value = withSequence(withTiming(0.93, { duration: 90 }), withSpring(1, spring.bouncy));
    }
  }, [reduce, shown, arm, lean, squash]);

  const doHop = useCallback(() => {
    if (reduce) return;
    squash.value = withSequence(
      withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.06, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160 }),
      withTiming(0.92, { duration: 70 }),
      withSpring(1, spring.bouncy),
    );
    lift.value = withSequence(
      withTiming(0, { duration: 90 }),
      withTiming(-size * 0.09, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 190, easing: Easing.in(Easing.quad) }),
    );
  }, [reduce, size, squash, lift]);

  const doTurn = useCallback(() => {
    if (reduce) return;
    turnX.value = withSequence(withTiming(0.82, { duration: 130, easing: Easing.out(Easing.quad) }), withSpring(1, spring.bouncy));
    setTimeout(doWave, 180);
  }, [reduce, turnX, doWave]);

  const doNod = useCallback(() => {
    if (reduce) return;
    squash.value = withSequence(withTiming(0.96, { duration: 140, easing: Easing.inOut(Easing.quad) }), withSpring(1, spring.bouncy));
  }, [reduce, squash]);

  const doPronk = useCallback(
    (opts?: { onLand?: () => void }) => runPronk({ lift, squash, shake, fade }, size, reduce, opts?.onLand),
    [size, reduce, lift, squash, shake, fade],
  );
  const doShiver = useCallback(() => runShiver({ lift, squash, shake, fade }, size, reduce), [size, reduce, lift, squash, shake, fade]);

  useImperativeHandle(
    ref,
    () => ({ wave: doWave, hop: doHop, turn: doTurn, nod: doNod, cheer: doHop, pronk: doPronk, shiver: doShiver }),
    [doWave, doHop, doTurn, doNod, doPronk, doShiver],
  );

  // ---- greet once on mount
  const greeted = useRef(false);
  useEffect(() => {
    if (!greet || greeted.current) return;
    greeted.current = true;
    const t = setTimeout(doWave, 520);
    return () => clearTimeout(t);
  }, [greet, doWave]);

  // ---- cheer: a hop every couple of seconds while the mood lasts
  useEffect(() => {
    if (mood !== 'cheer' || !live || reduce) return;
    doHop();
    const id = setInterval(doHop, 2400);
    return () => clearInterval(id);
  }, [mood, live, reduce, doHop]);

  // ---- pose transitions: squash, swap at the bottom, stretch, settle
  useEffect(() => {
    if (pose === shown) return;
    if (reduce) {
      fade.value = withSequence(
        withTiming(0, { duration: 90 }, (f) => {
          if (f) scheduleOnRN(setShown, pose);
        }),
        withTiming(1, { duration: 140 }),
      );
      return;
    }
    squash.value = withSequence(
      withTiming(0.82, { duration: 120, easing: Easing.in(Easing.quad) }, (f) => {
        if (f) scheduleOnRN(setShown, pose);
      }),
      withTiming(1.1, { duration: 130, easing: Easing.out(Easing.quad) }),
      withSpring(1, spring.bouncy),
    );
    lift.value = withSequence(
      withTiming(0, { duration: 120 }),
      withTiming(-size * 0.06, { duration: 130, easing: Easing.out(Easing.quad) }),
      withSpring(0, spring.gentle),
    );
  }, [pose, shown, reduce, size, squash, lift, fade]);

  const body = useAnimatedStyle(() => {
    const sq = squash.value;
    const b = breath.value;
    return {
      opacity: fade.value,
      transform: [
        { translateX: shake.value },
        { translateY: lift.value },
        { rotate: `${lean.value}deg` },
        { scaleX: (flip ? -1 : 1) * turnX.value * (1 / Math.sqrt(sq)) * (1 - 0.006 * b) },
        { scaleY: sq * (1 + 0.014 * b) },
      ],
    };
  });

  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${arm.value}deg` }] }));
  const f1 = useAnimatedStyle(() => ({ opacity: blink.value > 0.12 && blink.value <= 0.55 ? 1 : 0 }));
  const f2 = useAnimatedStyle(() => ({ opacity: blink.value > 0.55 && blink.value <= 0.9 ? 1 : 0 }));
  const f3 = useAnimatedStyle(() => ({ opacity: blink.value > 0.9 ? 1 : 0 }));
  const frames = [f1, f2, f3];

  const W = art.width * s;
  const H = size;
  const place = (f: Frame) => ({
    position: 'absolute' as const,
    left: (f.x - art.offset.x) * s,
    top: (f.y - art.offset.y) * s,
    width: f.w * s,
    height: f.h * s,
  });

  return (
    <View
      style={[{ width: W, height: H }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `50% ${art.anchorY * 100}%` }, body]}>
        <View style={shown === 'head' ? [StyleSheet.absoluteFill, styles.clip] : StyleSheet.absoluteFill}>
          <Image source={art.base} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} contentFit="fill" />
          {art.blink.map((b, i) => (
            <Animated.View key={i} style={[place(b.frame), frames[i]]}>
              <Image source={b.src} style={StyleSheet.absoluteFill} contentFit="fill" />
            </Animated.View>
          ))}
          {art.arm ? (
            <Animated.View
              style={[
                place(art.arm.frame),
                {
                  transformOrigin: `${(art.arm.pivot.x - art.arm.frame.x) * s}px ${(art.arm.pivot.y - art.arm.frame.y) * s}px`,
                },
                armStyle,
              ]}
            >
              <Image source={art.arm.src} style={StyleSheet.absoluteFill} contentFit="fill" />
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
