import type { StyleProp, ViewStyle } from 'react-native';

export type MascotPose = 'wave' | 'celebrate' | 'head';
/** `thinking`: head tilted the other way, eyes up, while the coach works something out. */
export type MascotMood = 'idle' | 'listening' | 'thinking' | 'cheer';

/**
 * Stable mascot API. RiveMascot implements it on native dev/release builds; the sprite rig
 * (MascotSprite) is the fallback for Expo Go, Expo web and Rive load failures.
 */
export interface MascotProps {
  pose?: MascotPose;
  mood?: MascotMood;
  /** Height in pt. Width follows the pose's artwork. */
  size: number;
  /** Wave once shortly after mount (only meaningful for pose="wave"). */
  greet?: boolean;
  /** Stop breathing and blinking, e.g. when the screen is not focused. */
  paused?: boolean;
  /** Mirror horizontally so the mascot faces the other way. */
  flip?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export interface MascotHandle {
  /** Arm wave (wave pose); a small hop for the other poses. */
  wave: () => void;
  /** Squash-and-stretch hop. */
  hop: () => void;
  /** Quick turn toward the viewer, then a wave. */
  turn: () => void;
  /** "Yes, that's it": a head nod with a soft squint. */
  nod: () => void;
  /** One big jump for joy (the wave pose switches to the celebrate drawing mid-air). */
  cheer: () => void;
  /**
   * The antelope's own celebration: a stiff-legged jump straight up off all four feet, then a
   * smaller second one (~1.2s). `onLand` fires on each landing (pair a haptic with it).
   * Reduced motion: a cross-fade dip, and `onLand` once.
   */
  pronk: (opts?: { onLand?: () => void }) => void;
  /** Cold: a quick sideways shiver (~0.4s). Reduced motion: nothing. */
  shiver: () => void;
}
