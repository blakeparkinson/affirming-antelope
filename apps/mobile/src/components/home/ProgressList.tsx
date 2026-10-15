import { FADED_BELOW, getSkillLevel, isFaded, skillSharpness, type DemoSkillProgress, type SkillId, type SkillLevelNumber } from '@antelope/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LevelPips, Pip, Raised, StepBadge, Text, border, color, space } from '@/design';
import { FADE_MS, spring, useReduceMotion } from '@/motion';
import type { ProgressRow } from '@/state/selectors';
import { useLearner } from '@/state/store';
import { TickSwap, useOnChange } from './motion';

/**
 * The course's core processes with their level state. One card, ruled rows.
 * On change: pips spring to the new fill, a new level or a completed process
 * pops its badge and ticks its caption over. Rows never change height. No
 * percentages: skills are shown as levels.
 *
 * Spaced review: a practised skill that has faded shows a thin sharpness bar under
 * its name. Practising it fills the bar back up ("Sharp again"), then the bar steps
 * aside. The bar sits in the row's padding, so it never changes the row's height.
 */
/** How long a refreshed row says "Sharp again" before the bar fades away, ms. */
const REFRESHED_HOLD_MS = 1600;
const SHARP_BAR_W = 88;

export function ProgressList({ rows, skills: skillsProp, now }: { rows: ProgressRow[]; skills?: Record<SkillId, DemoSkillProgress>; now: number }) {
  const live = useLearner((s) => s.skills);
  const skills = skillsProp ?? live;
  return (
    <Raised contentStyle={styles.face}>
      {rows.map((r, i) => (
        <Row key={r.key} row={r} progress={skills[r.skill]} now={now} index={i} last={i === rows.length - 1} />
      ))}
    </Raised>
  );
}

function Row({ row: r, progress: p, now, index: i, last }: { row: ProgressRow; progress: DemoSkillProgress; now: number; index: number; last: boolean }) {
  const reduce = useReduceMotion();
  const level = getSkillLevel(p.level);
  const locked = r.status === 'locked';
  const complete = r.status === 'complete';

  const sharp = locked ? null : skillSharpness(p, now);
  const faded = sharp !== null && sharp < FADED_BELOW;
  // a faded skill practised again: decided in render (not an effect) so the bar is still
  // mounted at its old fill when it springs to full
  const [prevAt, setPrevAt] = useState(p.lastPracticedAt);
  const [refreshed, setRefreshed] = useState(false);
  if (p.lastPracticedAt !== prevAt) {
    setPrevAt(p.lastPracticedAt);
    if (!locked && isFaded({ ...p, lastPracticedAt: prevAt }, now)) setRefreshed(true);
  }
  useEffect(() => {
    if (!refreshed) return;
    // one-shot hold, not a loop
    const t = setTimeout(() => setRefreshed(false), REFRESHED_HOLD_MS);
    return () => clearTimeout(t);
  }, [refreshed]);
  const showBar = faded || refreshed;
  // to two places, so a re-render a few seconds later doesn't nudge the bar
  const fill = refreshed ? 1 : Math.round((sharp ?? 1) * 100) / 100;
  // the bar fades in and out (the same under reduced motion); a refreshed bar waits for its fill to land
  const barOpacity = useSharedValue(showBar ? 1 : 0);
  useEffect(() => {
    barOpacity.value = showBar ? withTiming(1, { duration: FADE_MS }) : withDelay(reduce ? 0 : 120, withTiming(0, { duration: FADE_MS }));
  }, [showBar, reduce, barOpacity]);
  const barStyle = useAnimatedStyle(() => ({ opacity: barOpacity.value }));

  // badge content changed (new level, unlocked, completed): it pops like a stamp
  const pop = useSharedValue(1);
  useOnChange(`${r.status}-${p.level}`, () => {
    pop.value = reduce
      ? withSequence(withTiming(0.35, { duration: 0 }), withTiming(1, { duration: FADE_MS }))
      : withSequence(withTiming(0.7, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(1, spring.bouncy));
  });
  const badgeStyle = useAnimatedStyle(() => (reduce ? { opacity: pop.value } : { transform: [{ scale: pop.value }] }));

  const caption = locked
    ? r.opensWeek
      ? `Opens in week ${r.opensWeek}`
      : 'Not on this track'
    : refreshed
      ? 'Sharp again'
      : `Level ${p.level} · ${level.name}${faded ? ' · Fading' : ''}`;
  // what the pips are heading for; the last level has no next
  const next = !locked && !complete && p.level < 6 ? `Next: ${getSkillLevel((p.level + 1) as SkillLevelNumber).name}` : null;

  return (
    <View
      style={[styles.row, !last && styles.rule]}
      accessible
      accessibilityLabel={
        locked
          ? `${r.label}, locked`
          : complete
            ? `${r.label}, complete, level ${p.level} ${level.name}`
            : `${r.label}, level ${p.level} ${level.name}${faded ? `, fading, ${Math.round(sharp! * 100)}% sharp` : refreshed ? ', sharp again' : ''}${next ? `, ${next.toLowerCase()}` : ''}`
      }
    >
      <StepBadge shape="square" state={complete ? 'done' : locked ? 'locked' : 'level'} label={p.level} style={badgeStyle} />
      <View style={styles.copy}>
        <Text variant="bodyStrong" color={locked ? color.muted : color.ink}>
          {r.label}
        </Text>
        <TickSwap value={caption}>
          <Text variant="caption" color={refreshed ? color.primaryShadow : color.muted}>
            {caption}
          </Text>
        </TickSwap>
        <Animated.View style={[styles.sharp, barStyle]} pointerEvents="none">
          <Pip fill={fill} tint={color.primary} height={4} width={SHARP_BAR_W} settled />
        </Animated.View>
      </View>
      <View style={styles.right}>
        <LevelPips
          level={p.level}
          percent={complete ? 100 : p.percent}
          state={locked ? 'locked' : complete ? 'complete' : 'progress'}
          pipWidth={10}
          height={7}
          gap={3}
          delay={300 + i * 60}
        />
        {complete || locked ? (
          <Text variant="captionStrong" color={complete ? color.goldInk : color.faint}>
            {complete ? 'Done' : 'Locked'}
          </Text>
        ) : next ? (
          <TickSwap value={next}>
            <Text variant="captionStrong" color={color.primaryShadow}>
              {next}
            </Text>
          </TickSwap>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { paddingHorizontal: space[4], paddingVertical: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] + 2 },
  rule: { borderBottomWidth: border, borderBottomColor: color.rule },
  copy: { flex: 1 },
  // in the row's bottom padding: showing it never moves the row
  sharp: { position: 'absolute', left: 0, bottom: -9 },
  right: { alignItems: 'flex-end', gap: 6 },
});
