import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
 * A day a streak freeze covered shows a cobalt snowflake on a periwinkle face: kept, not
 * earned, so it never takes the ochre. `freezeNote` says so once, the visit after it happened.
 */
export function ThisWeek({
  streak,
  goal,
  weekDays,
  frozenDays,
  freezeNote,
}: {
  streak: number;
  goal: { target: number; done: number };
  weekDays: boolean[];
  frozenDays: boolean[];
  freezeNote?: string | null;
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
        {DAYS.map((d, i) => (
          <DayDot
            key={i}
            label={d}
            index={i}
            done={weekDays[i]}
            frozen={!weekDays[i] && !!frozenDays[i]}
            isToday={i === todayIdx}
            quiet={goal.done === goal.target}
          />
        ))}
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
  isToday,
  quiet,
}: {
  label: string;
  index: number;
  done: boolean;
  frozen: boolean;
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
          <View style={[styles.track, styles.trackFrozen]}>
            <SnowflakeIcon size={18} weight="bold" color={color.primary} />
          </View>
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
  note: { marginTop: space[4] },
});
