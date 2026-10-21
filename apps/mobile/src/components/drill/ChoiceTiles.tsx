import type { Drill } from '@antelope/core';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PressableSurface, StepBadge, Text, border, color, haptic, radius, space } from '@/design';
import { Burst, Enter, Expand, FADE_MS, spring, useReduceMotion, type BurstHandle } from '@/motion';
import { LETTERS, letterList } from './letters';

type Choice = NonNullable<Drill['choices']>[number];

/**
 * Level-1 drills: tappable answer tiles, evaluated locally. Select (soft face,
 * cobalt edge, letter badge fills), then reveal: the tile the drill asked for
 * turns ochre with a check, the others settle, and every tile opens its
 * explanation in place (heights grow smoothly, picks first, then the target,
 * then the rest). A pick that isn't a target says so at a glance without
 * scolding: a terracotta tile, a dash in its badge, and "Your pick · not quite"
 * naming the letter the drill asked for (it may be below the fold). Never red, never an X.
 *
 * Two tones on CHECK:
 * - Hit (the picks are exactly what the drill asked): the target's check
 *   punches to 1.35x in 110ms and settles on `bouncy`; on the punch's peak
 *   frame a small Burst flies from the badge and haptic.success fires (once,
 *   from the first target to resolve).
 * - Miss: the target still turns ochre ("C · what the drill asked for"), its check
 *   settles in calmly (0.85 → 1 on `settle`, no burst), and one light
 *   haptic.tick marks it.
 * `onResolved(hit)` fires on that same frame (e.g. to hop the coach).
 * Reduced motion: no scale, the explanations snap open and cross-fade.
 */
export function ChoiceTiles({
  choices,
  selected,
  revealed,
  multi,
  onSelect,
  onResolved,
}: {
  choices: Choice[];
  selected: number[];
  revealed: boolean;
  /** More than one tile is what the drill asks for: tiles toggle. */
  multi?: boolean;
  onSelect: (i: number) => void;
  /** Fires once per reveal, on the frame the target's check lands. */
  onResolved?: (hit: boolean) => void;
}) {
  const targets = choices.map((c, i) => (c.isTarget ? i : -1)).filter((i) => i >= 0);
  const hit = selected.length === targets.length && selected.every((i) => targets.includes(i));
  // the target that resolves first carries the haptic
  const lead = targets.reduce((a, b) => (revealOrder(b, selected, choices) < revealOrder(a, selected, choices) ? b : a), targets[0] ?? -1);
  const askedFor = letterList(targets);
  const resolved = useRef(onResolved);
  resolved.current = onResolved;
  const onLeadPeak = useCallback(() => {
    if (hit) haptic.success();
    else haptic.tick();
    resolved.current?.(hit);
  }, [hit]);

  return (
    <View style={styles.list} accessibilityRole={multi ? 'list' : 'radiogroup'}>
      {choices.map((c, i) => (
        <Enter key={i} index={i} delay={420} style={revealed && c.isTarget ? styles.raise : undefined}>
          <Tile
            choice={c}
            i={i}
            multi={!!multi}
            selected={selected.includes(i)}
            revealed={revealed}
            hit={hit}
            askedFor={askedFor}
            order={revealOrder(i, selected, choices)}
            onPeak={i === lead ? onLeadPeak : undefined}
            onPress={() => onSelect(i)}
          />
        </Enter>
      ))}
    </View>
  );
}

/** The learner's picks resolve first, then the targets, then the rest. */
function revealOrder(i: number, selected: number[], choices: Choice[]) {
  if (selected.includes(i)) return selected.indexOf(i) * 0.5;
  if (choices[i].isTarget) return 1;
  return 2 + i;
}


function Tile({
  choice,
  i,
  multi,
  selected,
  revealed,
  hit,
  askedFor,
  order,
  onPeak,
  onPress,
}: {
  choice: Choice;
  i: number;
  multi: boolean;
  selected: boolean;
  revealed: boolean;
  hit: boolean;
  /** The target letters, for a miss's "the drill asked for C". */
  askedFor: string;
  order: number;
  onPeak?: () => void;
  onPress: () => void;
}) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  const dim = useSharedValue(1);
  const burst = useRef<BurstHandle>(null);
  const target = revealed && choice.isTarget;
  const quiet = revealed && !choice.isTarget && !selected;
  // picked, but not what the drill asked for
  const miss = revealed && selected && !choice.isTarget;
  const peakRef = useRef(onPeak);
  peakRef.current = onPeak;

  const onLand = useCallback(() => {
    if (hit) burst.current?.fire();
    peakRef.current?.();
  }, [hit]);

  useEffect(() => {
    if (selected && !revealed && !reduce) pop.value = withSequence(withSpring(1.18, spring.snappy), withSpring(1, spring.bouncy));
    if (!target) return;
    const land = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onLand);
    };
    const wait = order * 90;
    if (reduce) pop.value = withDelay(wait, withTiming(1, { duration: 0 }, land));
    else if (hit) pop.value = withDelay(wait, withSequence(withTiming(1.35, { duration: 110, easing: Easing.out(Easing.quad) }, land), withSpring(1, spring.bouncy)));
    else pop.value = withDelay(wait, withSequence(withTiming(0.85, { duration: 0 }, land), withSpring(1, spring.settle)));
    // onLand is read at fire time; re-running on its identity would replay the pop
  }, [selected, revealed, target, order, reduce, pop]);

  useEffect(() => {
    dim.value = withTiming(quiet ? 0.78 : 1, { duration: reduce ? FADE_MS : 260 });
  }, [quiet, reduce, dim]);

  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const fade = useAnimatedStyle(() => ({ opacity: dim.value }));

  const face = target ? color.goldTint : miss ? color.missTint : selected ? color.soft : color.white;
  const edge = target ? color.gold : miss ? color.miss : selected ? color.primary : color.line;
  const shadow = target ? color.goldShadow : miss ? color.missInk : selected ? color.primary : color.shadow;

  return (
    <Animated.View style={fade}>
      <PressableSurface
        onPress={onPress}
        disabled={revealed}
        haptic={revealed ? false : 'tick'}
        face={face}
        edge={edge}
        shadow={shadow}
        depth={4}
        radius={radius.surface}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={multi ? { checked: selected, disabled: revealed } : { selected, disabled: revealed }}
        accessibilityLabel={`${LETTERS[i]}. ${choice.text}${revealed ? (choice.isTarget ? '. What the drill asked for.' : miss ? `. Your pick, not quite${askedFor ? `: the drill asked for ${askedFor}` : ''}.` : '') + ' ' + choice.explanation : ''}`}
        contentStyle={styles.face}
      >
        <View style={styles.row}>
          <View style={styles.badgeBox}>
            <StepBadge shape="pill" state={target ? 'target' : miss ? 'miss' : selected ? 'selected' : 'letter'} label={LETTERS[i]} style={badge} />
            {choice.isTarget ? <Burst ref={burst} count={12} power={0.6} scale={0.85} duration={600} spread={80} /> : null}
          </View>
          <Text variant="bodyStrong" style={styles.text}>
            {choice.text}
          </Text>
        </View>
        {revealed ? (
          <Expand delay={120 + order * 110}>
            <View style={styles.explain}>
              {target ? (
                <Text variant="overline" color={color.goldInk} style={styles.tag}>
                  {/* the letter, since its badge now shows a check and a "not quite" names it */}
                  {`${LETTERS[i]} · ${selected ? 'your pick, ' : ''}what the drill asked for`}
                </Text>
              ) : miss ? (
                <Text variant="overline" color={color.missInk} style={styles.tag}>
                  {askedFor ? `Your pick · not quite. The drill asked for ${askedFor}.` : 'Your pick · not quite'}
                </Text>
              ) : null}
              <Text variant="bodySmall" color={color.ink}>
                {choice.explanation}
              </Text>
            </View>
          </Expand>
        ) : null}
      </PressableSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3] },
  face: { padding: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  raise: { zIndex: 2 },
  badgeBox: { width: 32, height: 32 },
  text: { flex: 1 },
  explain: { marginTop: space[3], paddingTop: space[3], borderTopWidth: border, borderTopColor: color.rule },
  tag: { marginBottom: 4 },
});
