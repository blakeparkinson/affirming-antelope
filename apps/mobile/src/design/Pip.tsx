import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { FADE_MS } from '@/motion/constants';
import { spring } from '@/motion/springs';
import { useReduceMotion } from '@/motion/useMotionPrefs';
import { color } from './tokens';

export interface PipProps {
  /** 0..1. The fill springs to it on `spring.settle`. */
  fill: number;
  tint: string;
  height: number;
  /** Fixed width in pt. Omit to flex (`flex: 1`), e.g. a segment of a ProgressBar. */
  width?: number;
  /** Wait before the fill moves. LevelPips staggers its six pips with this. */
  delay?: number;
  /** Start at `fill` instead of empty, so nothing animates until `fill` changes. */
  settled?: boolean;
  /**
   * Reduced motion: false = the fill snaps to its width. true = it keeps its full
   * width and cross-fades in (used where a growing bar would read as travel).
   */
  reducedFade?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * One track + fill. The shared element of `LevelPips` and `ProgressBar`: same
 * track colour, same settle spring, same reduced-motion path, so "level" and
 * "progress" fill the same way everywhere.
 */
export function Pip({ fill, tint, height, width, delay = 0, settled = false, reducedFade = false, style }: PipProps) {
  const reduce = useReduceMotion();
  const v = useSharedValue(settled ? fill : 0);
  // read when `fill` changes; a later render with another delay must not restart a fill that's waiting
  const wait = useRef(delay);
  wait.current = delay;
  useEffect(() => {
    // a staggered fade still waits its turn (LevelPips filling one by one); a snap is immediate
    if (reduce) v.value = reducedFade ? withDelay(wait.current, withTiming(fill, { duration: FADE_MS })) : withTiming(fill, { duration: 0 });
    else v.value = withDelay(wait.current, withSpring(fill, spring.settle));
  }, [fill, reduce, reducedFade, v]);
  const fillStyle = useAnimatedStyle(() =>
    reduce && reducedFade
      ? { width: '100%', opacity: v.value }
      : { width: `${Math.max(0, v.value) * 100}%` as `${number}%`, opacity: 1 },
  );
  return (
    <View style={[styles.track, width === undefined ? styles.flex : { width }, { height, borderRadius: height / 2 }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: tint, borderRadius: height / 2 }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: color.line, overflow: 'hidden' },
  flex: { flex: 1 },
  fill: { height: '100%' },
});
