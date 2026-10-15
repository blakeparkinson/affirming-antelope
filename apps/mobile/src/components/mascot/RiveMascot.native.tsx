// Only import this module when `riveAvailable` is true: @rive-app/react-native needs its native
// module at load time. index.ts takes care of that.
import { Fit, RiveView, useRiveFile, useViewModelInstance, type RiveViewRef, type ViewModelInstance } from '@rive-app/react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { runPronk, runShiver } from './choreo';
import { COACH, COACH_VM } from './coach.generated';
import { MascotSprite } from './MascotSprite';
import type { MascotHandle, MascotMood, MascotPose, MascotProps } from './types';

const FILE = require('../../../assets/rive/mascot-coach.riv');

type Trigger = (typeof COACH_VM.triggers)[number];

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

function moodValue(mood: MascotMood, reduce: boolean) {
  // reduced motion: keep the attentive moods, drop the repeating hops
  if (reduce && mood === 'cheer') return COACH_VM.mood.idle;
  return COACH_VM.mood[mood] ?? COACH_VM.mood.idle;
}

/**
 * The Rive "Coach" mascot behind the stable <Mascot> API. One artboard holds both drawings;
 * `pose`/`mood` are view-model numbers and the ref methods fire view-model triggers on the
 * "Coach" state machine (contract in DESIGN.md, Mascot). Sized like the sprite: `size` is the
 * height of the pose's drawing; the Rive canvas overhangs that box so hops and ears never clip.
 * Until the file is ready, or if it fails, the sprite rig renders instead.
 */
export const RiveMascot = forwardRef<MascotHandle, MascotProps>(function RiveMascot(props, ref) {
  const { pose = 'wave', mood = 'idle', size, greet = false, paused = false, flip = false, accessibilityLabel, style } = props;
  const reduce = useReduceMotion();
  const appActive = useAppActive();
  const live = appActive && !paused;

  const { riveFile, error: fileError } = useRiveFile(FILE);
  const { instance } = useViewModelInstance(riveFile ?? null, { async: true });
  const [viewReady, setViewReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const view = useRef<RiveViewRef | null>(null);
  const vm = useRef<ViewModelInstance | null>(null);
  vm.current = instance ?? null;

  // The box on screen lags the prop during a squash so head <-> full-body swaps happen at the bottom.
  const [shown, setShown] = useState<MascotPose>(pose);
  const squash = useSharedValue(1);
  const turnX = useSharedValue(1);
  // whole-body moves the rig has no trigger for (pronk, shiver) run on the wrapper
  const lift = useSharedValue(0);
  const shake = useSharedValue(0);
  const fade = useSharedValue(1);

  const setNumber = useCallback((name: 'pose' | 'mood' | 'still', value: number) => {
    const p = vm.current?.numberProperty(name);
    if (p && p.value !== value) p.value = value;
  }, []);
  const fire = useCallback((name: Trigger) => {
    vm.current?.triggerProperty(name)?.trigger();
  }, []);

  // ---- view-model inputs
  useEffect(() => {
    if (instance) setNumber('pose', COACH_VM.pose[shown]);
  }, [instance, shown, setNumber]);
  useEffect(() => {
    if (instance) setNumber('mood', moodValue(mood, reduce));
  }, [instance, mood, reduce, setNumber]);
  // reduced motion: the idle loop keeps breathing but stops the head/ear/tail/scarf drift
  useEffect(() => {
    if (instance) setNumber('still', reduce ? COACH_VM.still.on : COACH_VM.still.off);
  }, [instance, reduce, setNumber]);

  // ---- pause when told to or when the app is backgrounded
  useEffect(() => {
    const v = view.current;
    if (!v || !viewReady) return;
    if (live) v.play().catch(() => {});
    else v.pause().catch(() => {});
  }, [live, viewReady]);

  // ---- pose changes: squash, swap at the bottom, stretch, settle (the Rive side swaps instantly)
  useEffect(() => {
    if (pose === shown) return;
    if (reduce) {
      setShown(pose);
      return;
    }
    squash.value = withSequence(
      withTiming(0.84, { duration: 110, easing: Easing.in(Easing.quad) }, (f) => {
        if (f) scheduleOnRN(setShown, pose);
      }),
      withTiming(1.08, { duration: 120, easing: Easing.out(Easing.quad) }),
      withSpring(1, spring.bouncy),
    );
  }, [pose, shown, reduce, squash]);

  const act = useCallback(
    (name: Trigger) => {
      if (reduce && name !== 'blink' && name !== 'nod') return;
      fire(name);
    },
    [reduce, fire],
  );
  const doTurn = useCallback(() => {
    if (reduce) return;
    turnX.value = withSequence(withTiming(0.84, { duration: 130, easing: Easing.out(Easing.quad) }), withSpring(1, spring.bouncy));
    setTimeout(() => fire('wave'), 170);
  }, [reduce, turnX, fire]);

  const doPronk = useCallback(
    (opts?: { onLand?: () => void }) => runPronk({ lift, squash, shake, fade }, size, reduce, opts?.onLand),
    [size, reduce, lift, squash, shake, fade],
  );
  const doShiver = useCallback(() => runShiver({ lift, squash, shake, fade }, size, reduce), [size, reduce, lift, squash, shake, fade]);

  // `fire` is not part of MascotHandle; the dev playground uses it to reach every trigger
  useImperativeHandle(
    ref,
    () => ({
      wave: () => act('wave'),
      hop: () => act('hop'),
      turn: doTurn,
      nod: () => act('nod'),
      cheer: () => act('cheer'),
      pronk: doPronk,
      shiver: doShiver,
      fire: act,
    }),
    [act, doTurn, doPronk, doShiver],
  );

  // ---- greet once, after the view is up
  const greeted = useRef(false);
  useEffect(() => {
    if (!greet || greeted.current || !viewReady || !instance) return;
    greeted.current = true;
    const t = setTimeout(() => act('wave'), 520);
    return () => clearTimeout(t);
  }, [greet, viewReady, instance, act]);

  const onHybridRef = useCallback((r: RiveViewRef | null) => {
    view.current = r;
    if (!r) return;
    r.awaitViewReady()
      .then((ok) => setViewReady(ok))
      .catch(() => setFailed(true));
  }, []);

  const wrap = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateX: shake.value },
      { translateY: lift.value },
      { scaleX: (flip ? -1 : 1) * turnX.value * (1 / Math.sqrt(squash.value)) },
      { scaleY: squash.value },
    ],
  }));

  if (fileError || failed) return <MascotSprite {...props} ref={ref} />;

  const rect = COACH.rects[shown];
  const s = size / rect.h;
  const W = rect.w * s;
  const H = size;
  const canvas = {
    position: 'absolute' as const,
    left: -rect.x * s,
    top: -rect.y * s,
    width: COACH.artboard.width * s,
    height: COACH.artboard.height * s,
  };
  // head pose: crop the body below the face, but leave room above and beside for hops and ears
  const clip = shown === 'head';
  const pad = 140 * s;
  const ready = !!riveFile && !!instance && viewReady;

  return (
    <View
      style={[{ width: W, height: H }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
    >
      {!ready ? (
        // first paint and loading (a few hundred ms): a still sprite holds the spot so nothing pops
        // in; still, so a sprite hop can't be cut off mid-air when Rive takes over
        <MascotSprite {...props} ref={undefined} greet={false} paused mood="idle" style={StyleSheet.absoluteFill} />
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 96%' }, wrap]}>
        <View
          style={[
            clip ? { position: 'absolute', left: -pad, right: -pad, top: -rect.y * s, bottom: 0, overflow: 'hidden' } : StyleSheet.absoluteFill,
            !ready && styles.hidden,
          ]}
        >
          {riveFile && instance ? (
            <RiveView
              file={riveFile}
              stateMachineName="Coach"
              dataBind={instance}
              autoPlay
              fit={Fit.Contain}
              frameRate={60}
              hybridRef={{ f: onHybridRef }}
              onError={() => setFailed(true)}
              style={clip ? { ...canvas, left: canvas.left + pad, top: 0 } : canvas}
            />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({ hidden: { opacity: 0 } });
