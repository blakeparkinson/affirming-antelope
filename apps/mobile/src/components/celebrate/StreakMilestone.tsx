import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { Button, Hoofprint, Text, color, haptic, layout, space } from '@/design';
import { Burst, FADE_MS, RollingNumber, spring, useReduceMotion, type BurstHandle } from '@/motion';
import { useMoments, type MilestoneMoment } from '@/state/moments';

const LINES: Record<number, string> = {
  3: 'Three days running. That’s how a habit starts.',
  7: 'A full week. This is becoming how you talk.',
  14: 'Two weeks of small reps. It shows.',
  30: 'A month of practice. This is what change looks like.',
  50: 'Fifty days. Steady beats intense, every time.',
  100: 'One hundred days. Take a bow.',
};

/** Hoofprints in the achievement palette, with white so they read on cobalt. */
const PRINTS = [color.gold, color.white, color.gold, color.goldTint, color.gold, color.white];

/*
 * Storyboard. t = 0 when the moment opens (after the completion ticks have landed).
 *
 *   t 0      cobalt floods in (200ms fade); the stage (mascot, number, copy) rises 18pt
 *            and fades in on `gentle`
 *   t 150    the streak number rolls from the old streak to the milestone, digits right to left
 *   t 300    the antelope PRONKS (see mascot/choreo.ts)
 *   t 850    LAND 1: hoofprint Burst from its feet (22 prints, all round) + haptic.success
 *   t 1220   LAND 2: haptic.press
 *   t ~1470  rest. "Keep going" has been live since t 0.
 *
 * Tap anywhere (or the button, or back) to leave at any point: a 160ms fade.
 * Reduced motion: the backdrop and stage cross-fade in, the number snaps, the antelope's
 * pronk is a cross-fade dip, no prints; haptic.success still marks the beat.
 */
const ROLL_AT = 150;
const PRONK_AT = 300;

export function MilestoneHost() {
  const showing = useMoments((s) => s.showing);
  const dismiss = useMoments((s) => s.dismiss);
  if (!showing) return null;
  return <StreakMilestone key={showing.milestone} moment={showing} onDone={dismiss} />;
}

function StreakMilestone({ moment, onDone }: { moment: MilestoneMoment; onDone: () => void }) {
  const reduce = useReduceMotion();
  const mascot = useRef<MascotHandle>(null);
  const burst = useRef<BurstHandle>(null);
  const backdrop = useSharedValue(0);
  const stage = useSharedValue(0);
  const leaving = useRef(false);
  const { milestone, from } = moment;
  const line = LINES[milestone] ?? 'Keep it going.';

  useEffect(() => {
    backdrop.value = withTiming(1, { duration: reduce ? FADE_MS : 200 });
    stage.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSpring(1, spring.gentle);
    AccessibilityInfo.announceForAccessibility(`${milestone}-day streak. ${line}`);
    let lands = 0;
    const t = setTimeout(
      () =>
        mascot.current?.pronk({
          onLand: () => {
            lands += 1;
            if (lands === 1) {
              haptic.success();
              burst.current?.fire();
            } else haptic.press();
          },
        }),
      reduce ? 0 : PRONK_AT,
    );
    return () => clearTimeout(t);
  }, [reduce, milestone, line, backdrop, stage]);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onDone);
    };
    stage.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) });
    backdrop.value = withDelay(40, withTiming(0, { duration: 160 }, done));
  }, [onDone, stage, backdrop]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const stageStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, stage.value * 1.4),
    transform: [{ translateY: reduce ? 0 : (1 - stage.value) * 18 }],
  }));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={leave}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Pressable style={styles.root} onPress={leave} accessibilityViewIsModal accessible={false}>
        <Animated.View style={[styles.stage, stageStyle]}>
          <View style={styles.hero}>
            <View style={styles.halo} />
            <View style={styles.ground} />
            <Mascot ref={mascot} pose="celebrate" size={176} accessibilityLabel="The antelope coach, pronking for joy" />
            {/* from its feet: the prints scatter like tracks */}
            <View style={styles.feet}>
              <Burst ref={burst} particles="hoofprints" colors={PRINTS} count={22} power={1.25} scale={1} duration={900} spread={180} />
            </View>
          </View>
          <View style={styles.count} accessible accessibilityRole="header" accessibilityLabel={`${milestone}-day streak`}>
            <Hoofprint size={44} tint={color.gold} rotate={-12} />
            <RollingNumber value={milestone} from={from} delay={reduce ? 0 : ROLL_AT} variant="hero" lineHeight={84} color={color.white} style={styles.number} />
          </View>
          <Text variant="heading" color={color.white} align="center">
            day streak
          </Text>
          <Text variant="body" color={color.onPrimaryBody} align="center" style={styles.line}>
            {line}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.actions, stageStyle]}>
          <Button variant="onPrimary" label="Keep going" fullWidth onPress={leave} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: color.primary },
  root: { flex: 1, justifyContent: 'space-between', paddingHorizontal: layout.gutter, paddingTop: 96, paddingBottom: 56 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2] },
  hero: { alignItems: 'center', justifyContent: 'flex-end', height: 250, width: 260, marginBottom: space[4] },
  halo: { position: 'absolute', width: 240, height: 240, borderRadius: 120, top: 0, backgroundColor: color.onPrimaryChip },
  ground: { position: 'absolute', bottom: -6, width: 200, height: 26, borderRadius: 100, backgroundColor: color.primaryShadow },
  feet: { position: 'absolute', bottom: 6, left: 0, right: 0, height: 0 },
  count: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  number: { fontSize: 76 },
  line: { maxWidth: 300, marginTop: space[2] },
  actions: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
