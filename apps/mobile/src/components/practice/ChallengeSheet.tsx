import { SETTING_LABELS, getSkill, type ScenarioSpec, type Setting } from '@antelope/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ArrowRightIcon, Avatar, BottomSheet, Button, Chip, Text, color, haptic, scenarioAvatar, radius, space } from '@/design';
import { Enter, spring, useReduceMotion } from '@/motion';

const ROW = 84;
const LOOPS = 4;
const DIFF: Record<ScenarioSpec['difficulty'], string> = { intro: 'Intro', intermediate: 'Intermediate', advanced: 'Advanced' };

/**
 * "Challenge me": a slot-machine shuffle through the scenario cast. The strip
 * decelerates, ticks a haptic as each person passes the window, overshoots a
 * hair and settles on the pick.
 */
export function ChallengeSheet({
  open,
  onClose,
  onStart,
  scenarios,
  setting,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (s: ScenarioSpec) => void;
  /** The pool to shuffle: the scenarios in the setting Practice is showing. May be empty or a single scenario. */
  scenarios: ScenarioSpec[];
  setting: Setting;
}) {
  const reduce = useReduceMotion();
  const [pick, setPick] = useState<number | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const y = useSharedValue(0);
  const n = scenarios.length;
  const strip = Array.from({ length: n * (LOOPS + 1) }, (_, i) => scenarios[i % n]);
  const single = n === 1;

  useEffect(() => {
    if (!open) return;
    setPick(null);
    if (n === 0) return;
    const chosen = Math.floor(Math.random() * n);
    const target = (LOOPS * n + chosen) * ROW;
    const land = () => {
      setPick(chosen);
      haptic.success();
    };
    y.value = 0;
    if (reduce) {
      y.value = target;
      land();
      return;
    }
    y.value = withSequence(
      withTiming(target + 10, { duration: 1500, easing: Easing.bezier(0.15, 0.6, 0.2, 1) }),
      withSpring(target, spring.release, (f) => {
        if (f) scheduleOnRN(land);
      }),
    );
  }, [open, spinKey, n, scenarios, reduce, y]);

  useAnimatedReaction(
    () => Math.round(y.value / ROW),
    (i, prev) => {
      if (prev !== null && i !== prev) scheduleOnRN(haptic.tick);
    },
  );

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -y.value }] }));
  const s = pick !== null ? (scenarios[pick] ?? null) : null;
  const counterpart = SETTING_LABELS[setting].counterpart;

  return (
    <BottomSheet open={open} onClose={onClose} accessibilityLabel="Challenge me">
      <Text variant="overline" color={color.primaryShadow}>
        Challenge me
      </Text>
      <Text variant="title" style={styles.title}>
        {n === 0 ? `No ${counterpart} scenarios yet` : s ? 'Here’s your conversation' : 'Finding someone to talk to…'}
      </Text>

      {n === 0 ? (
        <Text variant="body" color={color.muted} style={styles.empty}>
          We’re still adding {SETTING_LABELS[setting].counterparts} to practise with. Pick a skill and start a drill or role-play instead.
        </Text>
      ) : (
      <View style={styles.window} accessibilityElementsHidden={!s}>
        <Animated.View style={stripStyle}>
          {strip.map((sc, i) => (
            <View key={i} style={styles.row}>
              <Avatar {...scenarioAvatar(sc)} size={56} />
              <View style={styles.rowCopy}>
                <Text variant="subheading" numberOfLines={1}>
                  {sc.persona.name}
                </Text>
                <Text variant="caption" color={color.muted} numberOfLines={1}>
                  {sc.persona.role}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>
      )}

      <View style={[styles.details, n === 0 && styles.detailsEmpty]}>
        {s ? (
          <Enter key={s.id}>
            <Text variant="heading">{s.title}</Text>
            <View style={styles.chips}>
              <Chip label={s.context} tone="soft" />
              <Chip label={getSkill(s.primaryChallenge).name} tone="soft" />
              <Chip label={DIFF[s.difficulty]} tone="neutral" />
            </View>
            <Text variant="body" color={color.muted} numberOfLines={3} style={styles.brief}>
              {s.learnerGoal}
            </Text>
          </Enter>
        ) : null}
      </View>

      {n > 0 ? (
        <Button
          label="Start"
          disabled={!s}
          onPress={() => s && onStart(s)}
          fullWidth
          icon={<ArrowRightIcon size={20} weight="bold" color={s ? color.white : color.faint} />}
          accessibilityLabel={s ? `Start role-play with ${s.persona.name}` : 'Start'}
        />
      ) : null}
      {n === 0 ? (
        <Button variant="secondary" label="Close" onPress={onClose} fullWidth style={styles.again} />
      ) : (
        <>
          <Button
            variant="secondary"
            label="Shuffle again"
            disabled={!s || single}
            onPress={() => setSpinKey((k) => k + 1)}
            fullWidth
            style={styles.again}
          />
          {single ? (
            <Text variant="caption" color={color.muted} align="center" style={styles.hint}>
              Only one {counterpart} scenario so far, more on the way.
            </Text>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space[1], marginBottom: space[4] },
  window: {
    height: ROW,
    overflow: 'hidden',
    borderRadius: radius.surface,
    borderWidth: 2,
    borderColor: color.line,
    backgroundColor: color.soft,
  },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4] },
  rowCopy: { flex: 1 },
  details: { minHeight: 150, paddingTop: space[4] },
  detailsEmpty: { minHeight: 0, paddingTop: 0 },
  empty: { marginBottom: space[2] },
  hint: { marginTop: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
  brief: { marginTop: space[3] },
  again: { marginTop: space[3] },
});
