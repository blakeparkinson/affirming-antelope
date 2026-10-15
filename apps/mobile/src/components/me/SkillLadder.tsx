import { SKILL_LEVELS, skillLevelQuestion, type DemoSkillProgress, type Skill } from '@antelope/core';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CaretDownIcon, CheckIcon, LevelPips, Text, color, haptic, layout, radius, skillTint, space } from '@/design';
import { Enter, spring } from '@/motion';

/** The newly levelled row's glow: up in 420ms, held, then a slow 1.1s fade. Once. */
const GLOW = { rise: 420, hold: 900, fade: 1100, peak: 0.16 } as const;
/** How often a waiting glow checks whether its row has scrolled into view, and how long it waits once there. */
const VISIBLE_POLL = 200;
const VISIBLE_SETTLE = 250;

/**
 * One skill: its current level question, expanding to the full six-rung ladder.
 * `glow`: the skill levelled up since Me was last in view; its row glows softly in the skill's colour,
 * once, when the row is first on screen (the skill levels often sit below the fold).
 */
export function SkillLadder({ skill, progress, last, glow = false }: { skill: Skill; progress: DemoSkillProgress; last: boolean; glow?: boolean }) {
  const [open, setOpen] = useState(false);
  const shine = useSharedValue(0);
  const row = useRef<View>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!glow) return;
    const bottom = height - insets.bottom - layout.tabBarHeight;
    const poll = setInterval(() => {
      row.current?.measureInWindow((_x, y, _w, h) => {
        // the whole row, below the status bar and above the tab bar
        if (!h || y < insets.top || y + h > bottom) return;
        clearInterval(poll);
        // opacity only, so reduced motion plays it as is
        shine.value = withDelay(
          VISIBLE_SETTLE,
          withSequence(
            withTiming(GLOW.peak, { duration: GLOW.rise, easing: Easing.out(Easing.quad) }),
            withDelay(GLOW.hold, withTiming(0, { duration: GLOW.fade, easing: Easing.inOut(Easing.quad) })),
          ),
        );
      });
    }, VISIBLE_POLL);
    return () => clearInterval(poll);
  }, [glow, shine, height, insets.top, insets.bottom]);
  const shineStyle = useAnimatedStyle(() => ({ opacity: shine.value }));
  const rot = useSharedValue(0);
  const caret = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 180}deg` }] }));
  const fresh = progress.status === 'locked';
  const level = SKILL_LEVELS[progress.level - 1];

  return (
    <View ref={row} collapsable={false} style={[styles.wrap, !last && styles.rule]}>
      <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: skillTint[skill.id] }, shineStyle]} />
      <Pressable
        onPress={() => {
          haptic.tick();
          rot.value = withSpring(open ? 0 : 1, spring.snappy);
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${skill.name}. ${fresh ? 'Not started' : `Level ${progress.level}, ${level.name}`}`}
        accessibilityHint="Shows all six levels"
        style={styles.head}
      >
        <View style={styles.headCopy}>
          <View style={styles.nameRow}>
            <Text variant="bodyStrong" style={styles.name}>
              {skill.name}
            </Text>
            <LevelPips
              level={progress.level}
              percent={progress.percent}
              state={fresh ? 'locked' : progress.status === 'complete' ? 'complete' : 'progress'}
              pipWidth={10}
              height={6}
              gap={3}
            />
          </View>
          <Text variant="caption" color={color.muted} numberOfLines={open ? undefined : 2}>
            {fresh ? 'Not started yet' : `Level ${progress.level} — ${level.name}: ${skillLevelQuestion(skill.id, progress.level)}`}
          </Text>
        </View>
        <Animated.View style={caret}>
          <CaretDownIcon size={18} weight="bold" color={color.faint} />
        </Animated.View>
      </Pressable>

      {open && (
        <View style={styles.ladder}>
          {SKILL_LEVELS.map((l, i) => {
            const done = !fresh && (l.level < progress.level || (l.level === progress.level && progress.percent >= 100));
            const now = !fresh && l.level === progress.level && !done;
            return (
              <Enter key={l.level} index={i} style={styles.rung}>
                <View style={styles.rail}>
                  <View style={[styles.dot, done && styles.dotDone, now && styles.dotNow]}>
                    {done ? (
                      <CheckIcon size={12} weight="bold" color={color.navy} />
                    ) : (
                      <Text variant="caption" color={now ? color.white : color.muted} style={styles.dotNum} maxScale={1}>
                        {l.level}
                      </Text>
                    )}
                  </View>
                  {i < 5 && <View style={[styles.line, done && styles.lineDone]} />}
                </View>
                <View style={styles.rungCopy}>
                  <Text variant="label" color={now ? color.primaryShadow : done ? color.ink : color.muted}>
                    {l.name}
                    {now ? "  ·  You're here" : ''}
                  </Text>
                  <Text variant="caption" color={now ? color.ink : color.muted}>
                    {skillLevelQuestion(skill.id, l.level)}
                  </Text>
                </View>
              </Enter>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space[1] },
  glow: { position: 'absolute', top: 2, bottom: 2, left: -space[2], right: -space[2], borderRadius: radius.md },
  rule: { borderBottomWidth: 2, borderBottomColor: color.soft },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], minHeight: 56 },
  headCopy: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  name: { flexShrink: 1 },
  ladder: { paddingBottom: space[3], paddingLeft: 2 },
  rung: { flexDirection: 'row', gap: space[3] },
  rail: { alignItems: 'center', width: 24 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.line,
    backgroundColor: color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: color.gold, borderColor: color.goldShadow },
  dotNow: { backgroundColor: color.primary, borderColor: color.primaryShadow },
  dotNum: { fontFamily: 'Nunito_900Black', fontSize: 11, lineHeight: 13 },
  line: { flex: 1, width: 2, backgroundColor: color.line, marginVertical: 2, minHeight: 14 },
  lineDone: { backgroundColor: color.gold },
  rungCopy: { flex: 1, paddingBottom: space[3] },
});
