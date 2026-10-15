import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { Callout, Card, Hoofprint, ProgressRing, SnowflakeIcon, Text, color, haptic, radius, space } from '@/design';
import { Expand, FADE_MS, RollingNumber, spring, useReduceMotion } from '@/motion';
import { weekdayIndex } from '@/state/store';
import { TickSwap, useOnChange } from './motion';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Weekly goal ring + the streak as a trail of hoofprints. No leaderboards, no flames.
 *
 * When a practice lands (Home passes values only once it's back in view):
 * today's hoofprint stamps into its dot first, the streak rolls and its print
 * thumps, then the ring springs to the new count (ochre + success when the goal is met).
 *
 * A day a streak freeze covered shows a cobalt hoofprint on a periwinkle face with a
 * snowflake badge: kept, not earned, so it never takes the ochre. `freezeNote` says so once,
 * the visit after it happened, and the days in `reveal` play the ice reveal (FreezeReveal
 * below); `onShiver` fires when the ice has formed, for the antelope to shiver.
 */
export function ThisWeek({
  streak,
  goal,
  weekDays,
  frozenDays,
  freezeNote,
  reveal,
  onShiver,
}: {
  streak: number;
  goal: { target: number; done: number };
  weekDays: boolean[];
  frozenDays: boolean[];
  freezeNote?: string | null;
  /** Monday-start: the frozen days whose pip plays the ice reveal on this visit. */
  reveal?: boolean[] | null;
  onShiver?: () => void;
}) {
  const reduce = useReduceMotion();
  const todayIdx = weekdayIndex();
  const hit = goal.done >= goal.target;
  const onFilled = useCallback(() => haptic.success(), []);
  // the ring's count starts where it is (no roll on mount); it rolls on change
  const [doneAtMount] = useState(goal.done);

  // the streak print thumps as the new number lands
  const thump = useSharedValue(1);
  useOnChange(streak, (prev, next) => {
    if (reduce || next <= prev) return;
    thump.value = withDelay(140, withSequence(withTiming(1.28, { duration: 120, easing: Easing.out(Easing.cubic) }), withSpring(1, spring.bouncy)));
  });
  const thumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: thump.value }] }));

  const caption = hit ? 'Weekly goal met. Nice steady work.' : `${goal.target - goal.done} more to hit your weekly goal`;

  return (
    <Card padding={space[5]}>
      <View style={styles.row}>
        <ProgressRing
          value={goal.done / goal.target}
          size={92}
          stroke={11}
          tint={hit ? color.gold : color.primary}
          delay={250}
          onFilled={onFilled}
          accessibilityLabel={`Weekly goal: ${goal.done} of ${goal.target} practices`}
        >
          <View style={styles.ringCenter}>
            <RollingNumber value={goal.done} from={doneAtMount} variant="heading" lineHeight={28} delay={250} style={styles.ringNum} />
            <Text variant="subheading" color={color.muted} maxScale={1} style={styles.ringOf}>
              /{goal.target}
            </Text>
          </View>
        </ProgressRing>
        <View style={styles.copy}>
          <Text variant="label" color={color.muted}>
            This week
          </Text>
          <View style={styles.streakRow} accessible accessibilityLabel={`${streak}-day streak`}>
            <Animated.View style={thumpStyle}>
              <Hoofprint size={26} tint={color.gold} rotate={-12} />
            </Animated.View>
            <RollingNumber value={streak} variant="title" delay={200} />
            <Text variant="subheading" color={color.ink} style={styles.days}>
              day streak
            </Text>
          </View>
          {/* the goal line can wrap differently once it changes; let the column grow, not jump */}
          <Expand appear={false}>
            <TickSwap value={caption}>
              <Text variant="caption" color={color.muted}>
                {caption}
              </Text>
            </TickSwap>
          </Expand>
        </View>
      </View>
      <Expand open={!!freezeNote}>
        {freezeNote ? (
          <Callout dense align="center" glyph={<SnowflakeIcon size={22} weight="bold" color={color.primary} />} style={styles.note}>
            <Text variant="bodySmall">{freezeNote}</Text>
          </Callout>
        ) : null}
      </Expand>
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {DAYS.map((d, i) => {
          const revealing = !weekDays[i] && !!reveal?.[i];
          return (
            <DayDot
              key={i}
              label={d}
              index={i}
              done={weekDays[i]}
              frozen={!weekDays[i] && (!!frozenDays[i] || revealing)}
              reveal={revealing ? reveal!.slice(0, i).filter(Boolean).length : null}
              onShiver={onShiver}
              isToday={i === todayIdx}
              quiet={goal.done === goal.target}
            />
          );
        })}
      </View>
    </Card>
  );
}

/**
 * One day of the week. A day that becomes done stamps in: the ochre face pops
 * over the empty track and its hoofprint lands with a little twist. Light
 * impact at the stamp unless the ring's success is about to play (`quiet`).
 */
function DayDot({
  label,
  index,
  done,
  frozen,
  reveal,
  onShiver,
  isToday,
  quiet,
}: {
  label: string;
  index: number;
  done: boolean;
  frozen: boolean;
  /** Plays the ice reveal: its order among this visit's revealed days (they stagger). */
  reveal: number | null;
  onShiver?: () => void;
  isToday: boolean;
  quiet: boolean;
}) {
  const reduce = useReduceMotion();
  const p = useSharedValue(done ? 1 : 0);
  const tilt = index % 2 ? 10 : -10;

  useOnChange(done, (_, next) => {
    if (!next) {
      p.value = withTiming(0, { duration: reduce ? FADE_MS : 160 });
      return;
    }
    if (reduce) {
      p.value = withTiming(1, { duration: FADE_MS });
      return;
    }
    const land = (finished?: boolean) => {
      'worklet';
      if (finished && !quiet) scheduleOnRN(haptic.press);
    };
    p.value = withSequence(
      withTiming(1.16, { duration: 170, easing: Easing.out(Easing.cubic) }, land),
      withSpring(1, spring.release),
    );
  });

  const face = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 2.2),
    transform: [{ scale: reduce ? 1 : 0.5 + 0.5 * p.value }],
  }));
  const print = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : Math.max(0, p.value * 1.6 - 0.6) }, { rotate: `${reduce ? 0 : (1 - Math.min(1, p.value)) * -40}deg` }],
  }));

  return (
    <View style={styles.day}>
      <View style={styles.dot}>
        {frozen ? (
          <FreezeReveal tilt={tilt} order={reveal} onShiver={onShiver} />
        ) : (
          <View style={[styles.track, isToday && styles.trackToday]}>
            <Hoofprint size={14} tint={isToday ? color.primaryTint : color.line} rotate={tilt} />
          </View>
        )}
        <Animated.View style={[styles.track, styles.trackDone, styles.overlay, face]}>
          <Animated.View style={print}>
            <Hoofprint size={16} tint={color.navy} rotate={tilt} />
          </Animated.View>
        </Animated.View>
      </View>
      <Text variant="captionStrong" color={isToday ? color.primary : color.muted}>
        {label}
      </Text>
    </View>
  );
}

/*
 * Freeze reveal storyboard, one pip. t = 0 is REVEAL_AT after Home opens (clear of the
 * splash and the cards' entrance), plus REVEAL_STAGGER per earlier revealed day.
 *
 *   t 0      ICE FORMS over the empty pip: a translucent cube grows 0.4 → 1 on `bouncy`
 *            and frosts in (opacity 0 → 1, 160ms)
 *   t 280    the antelope SHIVERS (`onShiver`, first revealed day only; ~420ms)
 *   t 700    the ice CRACKS: a zig-zag white crack draws in, 80ms
 *   t 790    the halves split and fall away (±9pt, ±16°, fading), 220ms
 *   t 840    the HOOF STAMPS: a cobalt print drops 14pt from 1.6x, ease-in, 170ms
 *   t 1010   CONTACT: the frozen face lands under it, squash 1.18/0.84 then `bouncy`,
 *            haptic.press; the snowflake badge pops
 *   t ~1300  rest
 *
 * Reduced motion: the ice cross-fades in, holds, and cross-fades to the frozen pip; same
 * haptic at the end, no shiver. A pip that isn't revealing just shows the frozen look.
 */
const REVEAL_AT = 900;
const REVEAL_STAGGER = 160;
const R = { form: 0, shiver: 280, crack: 700, split: 790, stamp: 840, fall: 170 } as const;
/** The ice overhangs the 36pt pip a little on every side. */
const ICE = 42;

function FreezeReveal({ tilt, order, onShiver }: { tilt: number; order: number | null; onShiver?: () => void }) {
  const reduce = useReduceMotion();
  const playing = order !== null;
  // 1 = the frozen face as it rests; while revealing it starts hidden under the ice
  const face = useSharedValue(playing ? 0 : 1);
  const ice = useSharedValue(0);
  const crack = useSharedValue(0);
  const split = useSharedValue(0);
  const drop = useSharedValue(playing ? 0 : 1);
  const squash = useSharedValue(0);
  const shiver = useCallback(() => onShiver?.(), [onShiver]);

  useEffect(() => {
    const all = [face, ice, crack, split, drop, squash];
    if (!playing) {
      all.forEach(cancelAnimation);
      face.value = 1;
      drop.value = 1;
      ice.value = 0;
      split.value = 0;
      crack.value = 0;
      squash.value = 0;
      return;
    }
    const at = REVEAL_AT + order * REVEAL_STAGGER;
    const contact = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(haptic.press);
    };
    if (reduce) {
      ice.value = withDelay(at, withSequence(withTiming(1, { duration: FADE_MS }), withTiming(1, { duration: 320 }), withTiming(0, { duration: FADE_MS })));
      face.value = withDelay(at + FADE_MS + 320, withTiming(1, { duration: FADE_MS }, contact));
      return () => all.forEach(cancelAnimation);
    }
    const t = order === 0 ? setTimeout(shiver, at + R.shiver) : undefined;
    ice.value = withDelay(at, withSpring(1, spring.bouncy));
    crack.value = withDelay(at + R.crack, withTiming(1, { duration: 80 }));
    split.value = withDelay(at + R.split, withTiming(1, { duration: 220, easing: Easing.in(Easing.quad) }));
    drop.value = withDelay(at + R.stamp, withTiming(1, { duration: R.fall, easing: Easing.in(Easing.quad) }, contact));
    face.value = withDelay(at + R.stamp + R.fall, withTiming(1, { duration: 40 }));
    squash.value = withDelay(at + R.stamp + R.fall, withSequence(withTiming(1, { duration: 45, easing: Easing.out(Easing.quad) }), withSpring(0, spring.bouncy)));
    return () => {
      if (t) clearTimeout(t);
      all.forEach(cancelAnimation);
    };
    // order is fixed for a reveal; replaying needs a new visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduce]);

  const faceStyle = useAnimatedStyle(() => {
    const s = squash.value;
    return {
      opacity: face.value,
      transform: reduce ? [] : [{ scaleX: 1 + 0.18 * s }, { scaleY: 1 - 0.16 * s }],
    };
  });
  const printStyle = useAnimatedStyle(() => {
    const d = drop.value;
    if (reduce) return { opacity: face.value };
    const lift = 1 + 0.6 * (1 - d);
    return { opacity: Math.min(1, d * 3), transform: [{ translateY: -14 * (1 - d) }, { scale: lift }, { rotate: `${tilt}deg` }] };
  });
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: face.value,
    transform: [{ scale: reduce ? 1 : 0.4 + 0.6 * face.value + 0.25 * squash.value }],
  }));
  const left = useIceHalf(ice, split, -1, reduce);
  const right = useIceHalf(ice, split, 1, reduce);
  const crackStyle = useAnimatedStyle(() => ({ opacity: crack.value * (1 - split.value) }));

  return (
    <>
      {playing ? <View style={styles.track} /> : null}
      <Animated.View style={[styles.track, styles.trackFrozen, styles.overlay, faceStyle]}>
        <Animated.View style={printStyle}>
          <Hoofprint size={16} tint={color.primary} rotate={0} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.badge, badgeStyle]}>
        <SnowflakeIcon size={10} weight="bold" color={color.primary} />
      </Animated.View>
      {playing ? (
        <View style={styles.ice} pointerEvents="none">
          <Animated.View style={[styles.iceHalf, { left: 0, transformOrigin: '100% 50%' }, left]}>
            <View style={[styles.iceCube, { left: 0 }]}>
              <View style={styles.iceShine} />
            </View>
          </Animated.View>
          <Animated.View style={[styles.iceHalf, { left: ICE / 2, transformOrigin: '0% 50%' }, right]}>
            <View style={[styles.iceCube, { left: -ICE / 2 }]}>
              <View style={styles.iceShine} />
            </View>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, crackStyle]}>
            <Svg width={ICE} height={ICE} viewBox="0 0 42 42">
              <Path d="M22 3 L18 13 L24 20 L17 28 L22 34 L20 39" stroke={color.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Path d="M24 20 L31 23" stroke={color.white} strokeWidth={1.6} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}

/** One half of the ice cube: it grows with the rest, then falls away to its side when it splits. */
function useIceHalf(ice: SharedValue<number>, split: SharedValue<number>, side: -1 | 1, reduce: boolean) {
  return useAnimatedStyle(() => {
    const f = ice.value;
    const p = split.value;
    if (reduce) return { opacity: f };
    return {
      opacity: Math.min(1, f * 2) * (1 - p),
      transform: [{ translateX: side * 9 * p }, { translateY: 7 * p * p }, { rotate: `${side * 16 * p}deg` }, { scale: 0.4 + 0.6 * f }],
    };
  });
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  ringCenter: { flexDirection: 'row', alignItems: 'flex-end' },
  ringNum: { fontSize: 24 },
  ringOf: { marginBottom: 2 },
  copy: { flex: 1, gap: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  days: { marginLeft: 2, marginTop: 4 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[5] },
  day: { alignItems: 'center', gap: 6 },
  dot: { width: 36, height: 36 },
  track: {
    width: 36,
    height: 36,
    borderRadius: radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.white,
    borderWidth: 2,
    borderColor: color.line,
  },
  overlay: { position: 'absolute', left: 0, top: 0 },
  trackDone: { backgroundColor: color.gold, borderColor: color.goldShadow, borderBottomWidth: 4 },
  trackToday: { borderColor: color.primary, borderStyle: 'dashed' },
  trackFrozen: { backgroundColor: color.soft, borderColor: color.primaryTint, borderBottomWidth: 4 },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: color.white,
    borderWidth: 1.5,
    borderColor: color.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ice: { position: 'absolute', left: (36 - ICE) / 2, top: (36 - ICE) / 2, width: ICE, height: ICE },
  iceHalf: { position: 'absolute', top: 0, width: ICE / 2, height: ICE, overflow: 'hidden' },
  iceCube: {
    position: 'absolute',
    top: 0,
    width: ICE,
    height: ICE,
    borderRadius: 12,
    backgroundColor: 'rgba(201, 210, 250, 0.82)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomColor: 'rgba(79, 107, 237, 0.45)',
    borderBottomWidth: 4,
  },
  iceShine: { position: 'absolute', left: 6, top: 5, width: 7, height: 16, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.85)', transform: [{ rotate: '18deg' }] },
  note: { marginTop: space[4] },
});
