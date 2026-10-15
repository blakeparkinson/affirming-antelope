import { Easing, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { FADE_MS } from '@/motion/constants';
import { spring } from '@/motion/springs';

/**
 * Whole-body moves both mascot renderers share (the sprite rig and the Rive wrapper drive
 * the same three values on the UI thread): `lift` (pt, negative is up), `squash` (scaleY,
 * anchored at the feet; width counter-scales) and `shake` (pt, sideways).
 */
export interface BodyValues {
  lift: SharedValue<number>;
  squash: SharedValue<number>;
  shake: SharedValue<number>;
  fade: SharedValue<number>;
}

/*
 * Pronk storyboard. Antelopes pronk: a stiff-legged jump straight up off all four feet.
 * Stiff is the point, so the body stays rigid in the air (no stretch past takeoff, no tilt);
 * all the give is in the crouch and the landings.
 *
 *   t 0      crouch: squash to 0.88, 90ms
 *   t 90     takeoff: a short stiff stretch (1.06) as it leaves the ground, then rigid;
 *            rises 34% of its height, decelerating, 250ms
 *   t 340    falls, accelerating, 210ms
 *   t 550    LAND 1: squash 0.86 in 50ms, `onLand`
 *   t 600    second, smaller pronk: 15%, 170ms up, 150ms down
 *   t 920    LAND 2: squash 0.93, `onLand`, then `bouncy` back to 1 (~250ms)
 *   t ~1170  rest
 *
 * Reduced motion: no travel. A cross-fade dip (1 → 0.55 → 1) marks the beat, and `onLand`
 * fires once, at the bottom of it.
 */
export const PRONK = { crouch: 90, up: 250, down: 210, contact: 50, up2: 170, down2: 150 } as const;
export const PRONK_MS = 1170;

export function runPronk(v: BodyValues, size: number, reduce: boolean, onLand?: () => void) {
  const landed = (finished?: boolean) => {
    'worklet';
    if (finished && onLand) scheduleOnRN(onLand);
  };
  if (reduce) {
    v.fade.value = withSequence(withTiming(0.55, { duration: FADE_MS }, landed), withTiming(1, { duration: FADE_MS }));
    return;
  }
  const up = Easing.out(Easing.quad);
  const down = Easing.in(Easing.quad);
  v.lift.value = withSequence(
    withTiming(0, { duration: PRONK.crouch }),
    withTiming(-size * 0.34, { duration: PRONK.up, easing: up }),
    withTiming(0, { duration: PRONK.down, easing: down }, landed),
    withTiming(0, { duration: PRONK.contact }),
    withTiming(-size * 0.15, { duration: PRONK.up2, easing: up }),
    withTiming(0, { duration: PRONK.down2, easing: down }, landed),
  );
  v.squash.value = withSequence(
    withTiming(0.88, { duration: PRONK.crouch, easing: Easing.out(Easing.quad) }),
    withTiming(1.06, { duration: 70, easing: Easing.out(Easing.quad) }),
    // rigid in the air: legs locked
    withTiming(1, { duration: 80 }),
    withTiming(1, { duration: PRONK.up + PRONK.down - 150 }),
    withTiming(0.86, { duration: PRONK.contact, easing: Easing.out(Easing.quad) }),
    withTiming(1.04, { duration: 60 }),
    withTiming(1, { duration: PRONK.up2 + PRONK.down2 - 60 }),
    withTiming(0.93, { duration: 45 }),
    withSpring(1, spring.bouncy),
  );
}

/*
 * Shiver: cold. Fast sideways judder that dies away, with a tiny hunch.
 *
 *   t 0     hunch to 0.97 (80ms) and judder: ±5% of height, 45ms per swing, 8 swings,
 *           each 18% smaller than the last
 *   t 360   settle back (`gentle`)
 *
 * Reduced motion: nothing moves (the scene around it carries the beat).
 */
export const SHIVER_MS = 420;

export function runShiver(v: BodyValues, size: number, reduce: boolean) {
  if (reduce) return;
  const amp = size * 0.05;
  const swings = Array.from({ length: 8 }, (_, i) => withTiming((i % 2 ? -1 : 1) * amp * Math.pow(0.82, i), { duration: 45, easing: Easing.inOut(Easing.sin) }));
  v.shake.value = withSequence(...swings, withSpring(0, spring.gentle));
  v.squash.value = withSequence(withTiming(0.97, { duration: 80 }), withTiming(0.97, { duration: 280 }), withSpring(1, spring.gentle));
}
