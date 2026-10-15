import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PopIn } from '@/components/celebrate/PopIn';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { ReminderOffer } from '@/components/reminders/ReminderOffer';
import { CheckIcon, Chip, Hoofprint, ProgressRing, Raised, SealCheckIcon, Text, color, haptic, space } from '@/design';
import { Burst, Enter, FADE_MS, RollingNumber, spring, useReduceMotion, type BurstHandle } from '@/motion';
import { useStreakDays, useThisWeek } from '@/state/selectors';
import { useMoments } from '@/state/moments';
import { liveStreak, thisWeek, useLearner } from '@/state/store';

export interface PracticeSnapshot {
  streak: number;
  goalDone: number;
  goalTarget: number;
}

/** Streak and weekly goal as they were when the screen opened, so completion can show the tick. */
export function usePracticeSnapshot(): PracticeSnapshot {
  const [snap] = useState(() => {
    const s = useLearner.getState();
    const goal = thisWeek(s).weeklyGoal;
    return { streak: liveStreak(s), goalDone: goal.done, goalTarget: goal.target };
  });
  return snap;
}

export function useLivePractice(): PracticeSnapshot {
  const streak = useStreakDays();
  const goal = useThisWeek().weeklyGoal;
  return { streak, goalDone: goal.done, goalTarget: goal.target };
}

/*
 * Storyboard. t = 0 is `delay` ms after `start` turns true.
 *
 *   t 0      Stamp: today's hoofprint appears above its pale imprint at 1.5x
 *            (compact 1.25x) and falls 34pt (compact 16pt), ease-in, 170ms.
 *   t 170    CONTACT. Squash to 1.15x / 0.82y (compact 1.1 / 0.88) in 45ms,
 *            anchored at the stamp's base, then `bouncy` back through a small
 *            stretch to 1. Same frame: haptic.thud + a small ochre-led Burst
 *            from the stamp (12 particles, ~600ms; compact 8, shorter reach).
 *   t 210    The streak number rolls before → after (digits right to left).
 *   t 320    The weekly ring advances on `settle`; the ring's count rolls with it.
 *   t 660    RING LANDS (scheduled when the arc reads as stopped, ahead of the spring tail). A halo scales out of the arc and fades (cobalt).
 *            If this practice closed the weekly goal (before < target ≤ after):
 *              - the arc turns cobalt → ochre (90ms cross-fade), the count swaps
 *                for a check that pops on `bouncy`
 *              - a bigger, all-round Burst from the ring (24; compact 14)
 *              - a second, ochre halo pulse
 *              - "Weekly goal hit" ochre chip pops in place of the label
 *              - haptic.success (the only success haptic in the sequence)
 *              - `onGoalHit()` (the completion screen hops the antelope)
 *   t 660+   If this practice crossed a streak milestone, its full-screen moment
 *            opens 450ms after the ring lands (StreakMilestone), once the ticks have read.
 *
 * Nothing here blocks input: the actions are live the moment they enter.
 * Reduced motion: the stamp fades in (no drop, no squash), numbers and ring
 * snap to their end values, ochre and the check cross-fade, no halo or burst.
 * The thud and success haptics still mark the same beats.
 */
const TUNE = {
  full: { hoof: 34, drop: 34, lift: 1.5, sx: 1.15, sy: 0.82, ring: 64, ringStroke: 9 },
  compact: { hoof: 26, drop: 16, lift: 1.25, sx: 1.1, sy: 0.88, ring: 44, ringStroke: 7 },
} as const;
const FALL_MS = 170;
const ROLL_AFTER = 40;
const RING_AFTER = 150;
/**
 * When the ring reads as landed, ms after it starts: `settle` is within ~3% of
 * its travel by then (for any distance), long before the spring's tail comes to
 * rest, so the land beat is scheduled on the UI thread rather than waiting for it.
 */
const RING_LAND_MS = 340;
/** A streak milestone's moment opens this long after the ring lands. */
const MILESTONE_AFTER = 450;

/** Achievement palette: ochre leads, a little cobalt and white so it reads on white cards. */
const STAMP_COLORS = [color.gold, color.gold, color.goldShadow, color.gold, color.primaryTint];
const GOAL_COLORS = [color.gold, color.gold, color.gold, color.goldShadow, color.primary, color.primaryTint];

/**
 * The streak hoofprint stamping and its number rolling, then the weekly ring
 * advancing. Used full-size on drill/lesson completion and as a compact strip
 * at the top of the debrief.
 *
 * `start` (default true) holds the whole sequence until it turns true, e.g.
 * until the coach's line above has finished arriving. It plays once.
 */
export function PracticeTicks({
  before,
  compact,
  delay = 450,
  start = true,
  onGoalHit,
  onLanded,
}: {
  before: PracticeSnapshot;
  compact?: boolean;
  delay?: number;
  start?: boolean;
  /** Fired on the frame the weekly ring closes, when this practice completed the goal. */
  onGoalHit?: () => void;
  /** Fired once the ring has landed: the ticks have read, so whatever follows them can start counting. */
  onLanded?: () => void;
}) {
  const reduce = useReduceMotion();
  const after = useLivePractice();
  const T = compact ? TUNE.compact : TUNE.full;
  const target = after.goalTarget;
  const ringFrom = Math.min(1, before.goalDone / before.goalTarget);
  const ringTo = Math.min(1, after.goalDone / target);
  const justHit = before.goalDone < before.goalTarget && after.goalDone >= target;
  const wasDone = before.goalDone >= before.goalTarget;

  // 0 waiting, 1 stamp landed (numbers roll), 2 ring landed
  const [phase, setPhase] = useState(0);
  const stampBurst = useRef<BurstHandle>(null);
  const goalBurst = useRef<BurstHandle>(null);
  const goalHit = useRef(onGoalHit);
  goalHit.current = onGoalHit;

  const fall = useSharedValue(0);
  const squash = useSharedValue(0);
  const ring = useSharedValue(ringFrom);
  const blend = useSharedValue(0);
  const glow = useSharedValue(0);
  const check = useSharedValue(0);
  // 0 waiting, 1 ring travelling, 2 ring landed (guards the land beat so it fires once)
  const stage = useSharedValue(0);
  const beat = useSharedValue(0);
  const ran = useRef(false);
  const milestoneAfter = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(milestoneAfter.current), []);

  const onContact = useCallback(() => {
    haptic.thud();
    stampBurst.current?.fire();
    setPhase(1);
  }, []);
  const onRingLand = useCallback(() => {
    setPhase(2);
    milestoneAfter.current = setTimeout(() => useMoments.getState().release(), MILESTONE_AFTER);
    onLanded?.();
    if (!justHit) return;
    haptic.success();
    goalBurst.current?.fire();
    goalHit.current?.();
  }, [justHit, onLanded]);

  const land = () => {
    'worklet';
    if (stage.value === 2) return;
    stage.value = 2;
    if (justHit) {
      blend.value = withTiming(1, { duration: reduce ? FADE_MS : 90 });
      check.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSpring(1, spring.bouncy);
      if (!reduce) glow.value = withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 0 }), withTiming(1, { duration: 520 }));
    } else if (!reduce) {
      glow.value = withTiming(1, { duration: 440 });
    }
    scheduleOnRN(onRingLand);
  };

  useEffect(() => {
    if (!start || ran.current) return;
    ran.current = true;
    // whichever arrives first: the scheduled land beat, or the spring ending (a ring that doesn't move ends at once)
    const settled = (finished?: boolean) => {
      'worklet';
      if (finished) land();
    };
    const contact = (finished?: boolean) => {
      'worklet';
      if (!finished) return;
      scheduleOnRN(onContact);
      stage.value = 1;
      if (reduce) {
        ring.value = withTiming(ringTo, { duration: 0 }, settled);
        return;
      }
      squash.value = withSequence(withTiming(1, { duration: 45, easing: Easing.out(Easing.quad) }), withSpring(0, spring.bouncy));
      ring.value = withDelay(RING_AFTER, withSpring(ringTo, spring.settle, settled));
      beat.value = withDelay(RING_AFTER + RING_LAND_MS, withTiming(1, { duration: 0 }, settled));
    };
    fall.value = reduce ? withDelay(delay * 0.5, withTiming(1, { duration: FADE_MS }, contact)) : withDelay(delay, withTiming(1, { duration: FALL_MS, easing: Easing.in(Easing.quad) }, contact));
    // land is a fresh closure each render; the sequence plays once
  }, [start, reduce, delay, ringTo, onContact, fall, squash, ring, stage, beat]);

  // the store moved after the sequence played (late record): just follow it
  useEffect(() => {
    if (phase >= 2) ring.value = reduce ? ringTo : withSpring(ringTo, spring.settle);
  }, [phase, ringTo, reduce, ring]);

  const stamp = useAnimatedStyle(() => {
    const f = fall.value;
    if (reduce) return { opacity: f };
    const s = squash.value;
    const lift = 1 + (T.lift - 1) * (1 - f);
    const sx = lift * (1 + (T.sx - 1) * s);
    const sy = lift * (1 - (1 - T.sy) * s);
    // scale about the stamp's base so the squash sits on the card
    const base = (T.hoof * (1 - sy)) / 2;
    return {
      opacity: Math.min(1, f * 4),
      transform: [{ translateY: -T.drop * (1 - f) + base }, { scaleX: sx }, { scaleY: sy }],
    };
  });
  const countStyle = useAnimatedStyle(() => ({
    opacity: 1 - check.value,
    transform: [{ scale: reduce ? 1 : 1 - 0.4 * Math.min(1, check.value) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, check.value * 2),
    transform: [{ scale: reduce ? 1 : 0.4 + 0.6 * check.value }, { rotate: reduce ? '0deg' : `${(1 - check.value) * -30}deg` }],
  }));

  const shownStreak = phase >= 1 ? after.streak : before.streak;
  const shownDone = Math.min(phase >= 1 ? after.goalDone : before.goalDone, target);
  const doneNow = phase >= 2 ? after.goalDone : before.goalDone;
  const ringTint = wasDone ? color.gold : color.primary;
  const numVariant = compact ? 'caption' : 'label';

  return (
    <View style={[styles.ticks, compact && styles.ticksCompact]}>
      <Raised tone="surface" depth={4} style={[styles.stat, { zIndex: phase >= 2 ? 1 : 2 }]} contentStyle={[styles.statFace, compact && styles.statFaceCompact]}>
        <View style={{ width: T.hoof, height: T.hoof }}>
          <View style={StyleSheet.absoluteFill}>
            <Hoofprint size={T.hoof} tint={color.softDeep} rotate={-12} />
          </View>
          <Animated.View style={[StyleSheet.absoluteFill, stamp]}>
            <Hoofprint size={T.hoof} tint={color.gold} rotate={-12} />
          </Animated.View>
          <Burst ref={stampBurst} colors={STAMP_COLORS} count={compact ? 8 : 12} power={compact ? 0.45 : 0.7} scale={compact ? 0.8 : 1} duration={compact ? 520 : 600} spread={80} />
        </View>
        <View style={compact ? undefined : styles.centered}>
          <RollingNumber value={shownStreak} from={before.streak} delay={reduce ? 0 : ROLL_AFTER} variant={compact ? 'heading' : 'number'} color={color.ink} />
          <Text variant="caption" color={color.muted}>
            day streak
          </Text>
        </View>
      </Raised>
      <Raised tone="surface" depth={4} style={[styles.stat, { zIndex: phase >= 2 ? 2 : 1 }]} contentStyle={[styles.statFace, compact && styles.statFaceCompact]}>
        <View style={{ width: T.ring, height: T.ring }}>
          <ProgressRing
            value={ringTo}
            progress={ring}
            blend={justHit ? blend : undefined}
            glow={glow}
            glowTint={justHit || wasDone ? color.gold : color.primary}
            size={T.ring}
            stroke={T.ringStroke}
            tint={ringTint}
            accessibilityLabel={`Weekly goal: ${after.goalDone} of ${target}`}
          >
            <Animated.View style={[styles.count, countStyle]}>
              <RollingNumber value={shownDone} from={Math.min(before.goalDone, target)} delay={reduce ? 0 : RING_AFTER} variant={numVariant} color={color.ink} />
              <Text variant={numVariant} color={color.ink} maxScale={1}>
                /{target}
              </Text>
            </Animated.View>
            {justHit ? (
              <Animated.View style={[StyleSheet.absoluteFill, styles.centerAll, checkStyle]}>
                <CheckIcon size={compact ? 18 : 26} weight="bold" color={color.goldShadow} />
              </Animated.View>
            ) : null}
          </ProgressRing>
          <Burst ref={goalBurst} colors={GOAL_COLORS} count={compact ? 14 : 24} power={compact ? 0.75 : 1.15} scale={compact ? 0.85 : 1.1} duration={compact ? 620 : 760} spread={180} />
        </View>
        <View style={[styles.shrink, !compact && styles.centered]}>
          {justHit && phase >= 2 ? (
            <PopIn delay={reduce ? 0 : 60}>
              <Chip label={compact ? 'Goal hit' : 'Weekly goal hit'} tone="gold" icon={<SealCheckIcon size={14} weight="fill" color={color.goldInk} />} style={compact ? undefined : styles.chipCentered} />
            </PopIn>
          ) : (
            <Text variant="label">Weekly goal</Text>
          )}
          <Text variant="caption" color={color.muted} numberOfLines={2}>
            {doneNow >= target ? 'Done this week' : `${target - doneNow} to go`}
          </Text>
        </View>
      </Raised>
    </View>
  );
}

/** Full-screen completion: the antelope celebrates, the ticks land, then the actions (and, early on, the reminder offer). */
export function CompletionMoment({ title, subtitle, before, children }: { title: string; subtitle: string; before: PracticeSnapshot; children?: ReactNode }) {
  const focused = useIsFocused();
  const mascot = useRef<MascotHandle>(null);
  const [cheer, setCheer] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setCheer(false), 3200);
    return () => clearTimeout(t);
  }, []);
  const hop = useCallback(() => mascot.current?.hop(), []);
  // the reminder sheet waits for the ticks to land (and for any moment they release), never over them
  const [landed, setLanded] = useState(false);
  const onLanded = useCallback(() => setLanded(true), []);

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Enter from="scale">
          <Mascot ref={mascot} pose="celebrate" mood={cheer ? 'cheer' : 'idle'} size={168} paused={!focused} accessibilityLabel="The antelope coach, celebrating" />
        </Enter>
        <Enter index={2} style={styles.copy}>
          <Text variant="title" align="center" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color={color.muted} align="center">
            {subtitle}
          </Text>
        </Enter>
        <Enter index={4} style={styles.full}>
          <PracticeTicks before={before} delay={480} onGoalHit={hop} onLanded={onLanded} />
        </Enter>
      </View>
      {children ? <Enter index={6}>{children}</Enter> : null}
      <ReminderOffer ready={landed} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  // above the actions so a burst falling past the cards stays in front
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[5], zIndex: 1 },
  copy: { alignItems: 'center', gap: space[2], paddingHorizontal: space[4] },
  full: { alignSelf: 'stretch' },
  ticks: { flexDirection: 'row', gap: space[3] },
  ticksCompact: { gap: space[2] },
  stat: { flex: 1 },
  statFace: { alignItems: 'center', gap: space[2], padding: space[4] },
  statFaceCompact: { flexDirection: 'row', padding: space[3], gap: space[2] },
  shrink: { flexShrink: 1 },
  centered: { alignItems: 'center' },
  count: { flexDirection: 'row', alignItems: 'center' },
  centerAll: { alignItems: 'center', justifyContent: 'center' },
  chipCentered: { alignSelf: 'center' },
});
