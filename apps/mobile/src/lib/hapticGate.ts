/**
 * Independent beats can land together (a strong move's thud and the persona's first spark on the
 * same reply; a level-up's success and its first pip tick). A light haptic that close behind a
 * heavier one only smears it into a buzz, so the gate drops it. Light ones never mask each other:
 * an even run of ticks is a rhythm, not a pile-up. Heavy ones always play.
 */
export const HAPTIC_MASK_MS = 180;

export function createHapticGate(maskMs = HAPTIC_MASK_MS) {
  let heavyAt = -Infinity;
  return {
    /** A heavy haptic (thud, success, warn) is about to play. */
    heavy(now: number) {
      heavyAt = now;
      return true;
    },
    /** Whether a light haptic (tick, press) should play now. */
    light(now: number) {
      return now - heavyAt >= maskMs;
    },
  };
}
