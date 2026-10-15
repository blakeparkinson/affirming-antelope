import { getSkill, getSkillLevel, skillLevelQuestion, type SkillLevelNumber } from '@antelope/core';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Mascot, type MascotHandle } from '@/components/mascot';
import { Button, LevelPips, ProgressRing, Raised, Text, color, haptic, layout, skillTint, space } from '@/design';
import { Burst, FADE_MS, spring, useReduceMotion, type BurstHandle } from '@/motion';
import { useMoments, type LevelUpMoment } from '@/state/moments';

/*
 * Storyboard. t = 0 when the moment opens: after the completion ticks have landed, and
 * after a streak milestone if this practice crossed one too (the moment queue plays them
 * one at a time, streak first).
 *
 *   t 0      a periwinkle wash fades in (220ms); "Level up" and the skill's card rise
 *            18pt on `gentle`. The card shows the OLD level: its ring and current pip
 *            as far through the level as the skill was before this practice.
 *   t 380    the ring SWEEPS to full (520ms, ease-out) and the current pip fills with it.
 *   t 900    RING FULL: haptic.press and a halo off the ring.
 *   t 1000   FLIP: the card turns over about its vertical axis in perspective, on a spring
 *            with a slight overshoot (~7%, ~12°). It lifts 4% at the edge-on point.
 *            Each face is its own view: the front shows until 90°, the back (built turned
 *            180° so it reads the right way round) from 90°.
 *   ~1300    LAND (the angle first reaches 180°, heading into the overshoot): a Burst in
 *            the skill's colour from behind the card + haptic.success.
 *            The new level's pips fill one by one, 110ms apart, a tick each; the ring,
 *            reset to empty, sweeps to how far into the new level this practice reached.
 *   +250     the antelope's head pops up from the card's corner on `bouncy`
 *   +650     and nods. The level's question and "Keep going" fade in.
 *
 * Tap anywhere (or the button, or back) to leave at any point: a 160ms fade.
 * Reduced motion: wash and card fade in; no sweep, no flip, no burst. At t 600 the old card
 * cross-fades to the new one, the new pips fade in one by one (with their ticks), the ring
 * snaps; haptic.success still marks the swap and the antelope still nods.
 */
const SWEEP_AT = 380;
const SWEEP_MS = 520;
const FLIP_AT = 1000;
const SWAP_AT_REDUCED = 600;
/** ζ ≈ 0.66: one small overshoot past 180°, settles without a second swing. */
const FLIP = { damping: 14.5, stiffness: 120, mass: 1 } as const;
const PIP_STAGGER = 110;
/** A pip's settle spring reads as full about this long after it starts: the tick lands with it. */
const PIP_TICK_AFTER = 140;
const HEAD_AFTER = 250;
const NOD_AFTER = 650;
const CARD_H = 156;
const RING = 64;

export function LevelUpHost() {
  const showing = useMoments((s) => s.showing);
  const dismiss = useMoments((s) => s.dismiss);
  if (showing?.kind !== 'level-up') return null;
  return <LevelUp key={`${showing.skill}:${showing.to}`} moment={showing} onDone={dismiss} />;
}

function LevelUp({ moment, onDone }: { moment: LevelUpMoment; onDone: () => void }) {
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const skill = getSkill(moment.skill);
  const tint = skillTint[moment.skill];
  const to = getSkillLevel(moment.to);
  const cardW = Math.min(320, width - layout.gutter * 2);

  const mascot = useRef<MascotHandle>(null);
  const burst = useRef<BurstHandle>(null);
  const backdrop = useSharedValue(0);
  const stage = useSharedValue(0);
  const ringOld = useSharedValue(moment.fromPercent / 100);
  const ringNew = useSharedValue(0);
  const halo = useSharedValue(0);
  const flip = useSharedValue(0);
  const swap = useSharedValue(0);
  const head = useSharedValue(0);
  const after = useSharedValue(0);
  const landed = useSharedValue(false);
  const leaving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // old card: its current pip fills with the sweep. new card: pips empty until the land
  const [swept, setSwept] = useState(false);
  const [filled, setFilled] = useState(false);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onFull = useCallback(() => {
    haptic.press();
  }, []);

  const onLand = useCallback(() => {
    haptic.success();
    burst.current?.fire();
    setFilled(true);
    for (let i = 0; i < moment.to; i++) later(haptic.tick, i * PIP_STAGGER + PIP_TICK_AFTER);
    ringNew.value = reduce ? moment.toPercent / 100 : withDelay(moment.to * PIP_STAGGER, withSpring(moment.toPercent / 100, spring.settle));
    head.value = reduce ? withTiming(1, { duration: FADE_MS }) : withDelay(HEAD_AFTER, withSpring(1, spring.bouncy));
    after.value = withDelay(reduce ? 0 : HEAD_AFTER, withTiming(1, { duration: reduce ? FADE_MS : 260 }));
    later(() => mascot.current?.nod(), reduce ? FADE_MS : NOD_AFTER);
  }, [moment.to, moment.toPercent, reduce, later, ringNew, head, after]);

  useEffect(() => {
    backdrop.value = withTiming(1, { duration: reduce ? FADE_MS : 220 });
    stage.value = reduce ? withTiming(1, { duration: FADE_MS }) : withSpring(1, spring.gentle);
    AccessibilityInfo.announceForAccessibility(`Level up. ${skill.name} is now level ${moment.to}, ${to.name}.`);
    if (reduce) {
      swap.value = withDelay(SWAP_AT_REDUCED, withTiming(1, { duration: FADE_MS * 1.5 }, (f) => f && scheduleOnRN(onLand)));
      return;
    }
    later(() => setSwept(true), SWEEP_AT);
    ringOld.value = withDelay(
      SWEEP_AT,
      withTiming(1, { duration: SWEEP_MS, easing: Easing.out(Easing.cubic) }, (f) => {
        if (!f) return;
        halo.value = withTiming(1, { duration: 440 });
        scheduleOnRN(onFull);
      }),
    );
    flip.value = withDelay(FLIP_AT, withSpring(180, FLIP));
    // runs once per moment; the callbacks are stable for it
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the land beat: the first frame the card reaches 180°
  useAnimatedReaction(
    () => flip.value,
    (a, prev) => {
      if (landed.value || prev === null || a < 180 || prev >= 180) return;
      landed.value = true;
      scheduleOnRN(onLand);
    },
  );

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
  // the lift peaks edge-on and is gone by the land, so the overshoot reads as the card settling
  const cardStyle = useAnimatedStyle(() => {
    const lift = Math.sin((Math.min(180, Math.max(0, flip.value)) / 180) * Math.PI);
    return { transform: [{ translateY: -10 * lift }, { scale: 1 + 0.04 * lift }] };
  });
  // perspective first: iOS applies it only to the transforms after it
  const frontStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 1 - swap.value : flip.value < 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${reduce ? 0 : flip.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: reduce ? swap.value : flip.value >= 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${reduce ? 0 : flip.value - 180}deg` }],
  }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, head.value * 2),
    transform: reduce ? [] : [{ translateY: (1 - head.value) * 34 }, { scale: 0.6 + 0.4 * head.value }],
  }));
  const afterStyle = useAnimatedStyle(() => ({
    opacity: after.value,
    transform: [{ translateY: reduce ? 0 : (1 - after.value) * 8 }],
  }));

  const pipW = Math.floor((cardW - space[5] * 2 - 5 * 6) / 6);
  const colors = [tint, tint, tint, color.gold, color.primaryTint, tint];

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={leave}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <Pressable style={styles.root} onPress={leave} accessibilityViewIsModal accessible={false}>
        <Animated.View style={[styles.stage, stageStyle]}>
          <Text variant="title" align="center" accessibilityRole="header">
            Level up
          </Text>
          <View
            style={[styles.cardWrap, { width: cardW, height: CARD_H }]}
            accessible
            accessibilityLabel={`${skill.name}, now level ${moment.to}, ${to.name}`}
          >
            {/* behind the card: the burst comes out from under it as it lands */}
            <View style={styles.center} pointerEvents="none">
              <Burst ref={burst} colors={colors} count={34} power={1.7} scale={1.1} duration={900} spread={180} />
            </View>
            <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
              <Face style={frontStyle} tint={tint} name={skill.name} level={moment.from} ring={ringOld} ringTo={1} halo={halo} pips={{ percent: swept ? 100 : moment.fromPercent, pipW, settled: true }} />
              <Face
                style={backStyle}
                tint={tint}
                name={skill.name}
                level={moment.to}
                ring={ringNew}
                ringTo={moment.toPercent / 100}
                pips={{ percent: moment.toPercent, pipW, empty: !filled, stagger: PIP_STAGGER }}
              />
            </Animated.View>
            <Animated.View style={[styles.head, headStyle]} pointerEvents="none">
              <Mascot ref={mascot} pose="head" size={72} accessibilityLabel="The antelope coach, nodding" />
            </Animated.View>
          </View>
          <Animated.View style={[styles.after, afterStyle]}>
            <Text variant="bodyStrong" align="center">
              {to.name}
            </Text>
            <Text variant="body" color={color.muted} align="center">
              {skillLevelQuestion(moment.skill, moment.to)}
            </Text>
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.actions, stageStyle]}>
          <Button label="Keep going" fullWidth onPress={leave} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** One side of the skill card. Both sides fill the card; the flip shows one at a time. */
function Face({
  style,
  tint,
  name,
  level,
  ring,
  ringTo,
  halo,
  pips,
}: {
  style: ComponentProps<typeof Animated.View>['style'];
  tint: string;
  name: string;
  level: SkillLevelNumber;
  ring: SharedValue<number>;
  /** Where `ring` is heading, for accessibility. */
  ringTo: number;
  halo?: SharedValue<number>;
  pips: { percent: number; pipW: number; empty?: boolean; settled?: boolean; stagger?: number };
}) {
  const l = getSkillLevel(level);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.face, style]}>
      <Raised tone="surface" edge={tint} shadow={tint} depth={5} style={styles.fill} contentStyle={styles.faceInner}>
        <View style={styles.row}>
          <ProgressRing value={ringTo} progress={ring} glow={halo} glowTint={tint} size={RING} stroke={8} tint={tint}>
            <Text variant="heading" color={color.ink} maxScale={1}>
              {level}
            </Text>
          </ProgressRing>
          <View style={styles.copy}>
            <Text variant="overline" color={tint} maxScale={1.2}>
              Level {level}
            </Text>
            <Text variant="subheading" numberOfLines={2}>
              {name}
            </Text>
            <Text variant="caption" color={color.muted}>
              {l.name}
            </Text>
          </View>
        </View>
        <LevelPips
          key={pips.empty ? 'empty' : 'filled'}
          level={level}
          percent={pips.percent}
          state={pips.empty ? 'locked' : 'progress'}
          pipWidth={pips.pipW}
          height={10}
          gap={6}
          stagger={pips.stagger}
          settled={pips.settled}
          reducedFade
        />
      </Raised>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: color.soft },
  root: { flex: 1, justifyContent: 'space-between', paddingHorizontal: layout.gutter, paddingTop: 96, paddingBottom: 56 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[6] },
  cardWrap: { marginTop: space[4] },
  center: { position: 'absolute', left: 0, right: 0, top: CARD_H / 2, height: 0, alignItems: 'center' },
  face: { backfaceVisibility: 'hidden' },
  fill: { flex: 1 },
  faceInner: { padding: space[5], justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  copy: { flex: 1, gap: 2 },
  head: { position: 'absolute', top: -58, right: -6 },
  after: { alignItems: 'center', gap: space[1], maxWidth: 300 },
  actions: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
