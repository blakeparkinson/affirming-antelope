import { warmthArc, type Stance, type Turn, type TurnAnnotation } from '@antelope/core';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { callName } from '@/components/practice-loop/names';
import { stanceLabel } from '@/components/practice-loop/moves';
import { Text, color, space, warmth as palette } from '@/design';
import { FADE_MS, useReduceMotion } from '@/motion';

/*
 * The warmth thread, played back: the same thread that ran along the conversation's
 * header, laid out start to end so you can see where they opened up and where you lost them.
 *
 *   0ms     the thread draws left to right (320ms a line, at most 2.4s), a bead riding its edge
 *   reach   each line's node pops as the bead arrives at it
 *   end     the caption names the turn that warmed them most, and the one that cooled them
 * Reduced motion (or a revisit): all there at once, faded in.
 */

/** On white, the resting colour needs a little more ink than the header's rule. */
function arcColor(w: number): string {
  return interpolateColor(w, [-1, -0.5, 0, 1], [palette.cold, palette.cool, '#C6CCE0', palette.warm]);
}

const H = 6;
const NODE = 12;

export function WarmthTimeline({
  turns,
  annotations,
  start,
  name,
  play,
  settled,
}: {
  turns: Turn[];
  annotations?: TurnAnnotation[];
  /** The scenario's starting stance, for the opening line. */
  start?: Stance;
  name: string;
  play: boolean;
  settled: boolean;
}) {
  const reduce = useReduceMotion();
  const first = callName(name);
  const points = useMemo(() => warmthArc(turns, { start, annotations }), [turns, start, annotations]);
  const [w, setW] = useState(0);
  const p = useSharedValue(settled || reduce ? 1 : 0);
  const shown = useSharedValue(settled ? 1 : 0);
  const n = points.length;

  useEffect(() => {
    if (!play || !w) return;
    shown.value = withTiming(1, { duration: FADE_MS });
    if (settled || reduce) {
      p.value = 1;
      return;
    }
    p.value = withDelay(120, withTiming(1, { duration: Math.min(2400, 320 * n), easing: Easing.inOut(Easing.quad) }));
  }, [play, w, settled, reduce, n, p, shown]);

  const reveal = useAnimatedStyle(() => ({ width: w * p.value, opacity: shown.value }));
  const bead = useAnimatedStyle(() => ({
    opacity: p.value > 0 && p.value < 1 ? shown.value : 0,
    transform: [{ translateX: w * p.value - NODE / 2 }],
  }));

  if (n < 2) return null;

  // the reply (by the learner's count) that each line answered
  const replyOf = (turnId: string) => turns.slice(0, turns.findIndex((t) => t.id === turnId)).filter((t) => t.speaker === 'learner').length;
  let rise = { by: 0, at: '' };
  let drop = { by: 0, at: '' };
  for (let i = 1; i < n; i++) {
    const d = points[i].warmth - points[i - 1].warmth;
    if (d > rise.by) rise = { by: d, at: points[i].turnId };
    if (d < drop.by) drop = { by: d, at: points[i].turnId };
  }
  const caption = [
    rise.at ? `${first} warmed most after your reply ${replyOf(rise.at)}.` : null,
    drop.at ? `${rise.at ? 'Cooled' : `${first} cooled`} after reply ${replyOf(drop.at)}.` : null,
  ]
    .filter(Boolean)
    .join(' ') || `${first} stayed about the same throughout.`;
  const from = points[0];
  const to = points[n - 1];
  const summary = `${first} started ${stanceLabel(from.stance, from.warmth * 2).toLowerCase()} and ended ${stanceLabel(to.stance, to.warmth * 2).toLowerCase()}. ${caption}`;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Warmth over the conversation. ${summary}`}>
      <Text variant="overline" color={color.muted}>
        Warmth, line by line
      </Text>
      <View style={styles.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.reveal, reveal]}>
          {w ? (
            <Svg width={w} height={NODE}>
              <Defs>
                <LinearGradient id="warmth-arc" x1="0" y1="0" x2="1" y2="0">
                  {points.map((pt, i) => (
                    <Stop key={pt.turnId} offset={i / (n - 1)} stopColor={arcColor(pt.warmth)} />
                  ))}
                </LinearGradient>
              </Defs>
              <Rect x={0} y={(NODE - H) / 2} width={w} height={H} rx={H / 2} fill="url(#warmth-arc)" />
            </Svg>
          ) : null}
        </Animated.View>
        {w
          ? points.map((pt, i) => <Node key={pt.turnId} x={(w * i) / (n - 1)} at={i / (n - 1)} tint={arcColor(pt.warmth)} p={p} shown={shown} />)
          : null}
        <Animated.View style={[styles.bead, bead]} />
      </View>
      <View style={styles.ends}>
        <Text variant="caption" color={color.muted}>
          Start
        </Text>
        <Text variant="caption" color={color.muted}>
          End
        </Text>
      </View>
      <Text variant="body" color={color.ink} style={styles.caption}>
        {caption}
      </Text>
    </View>
  );
}

function Node({ x, at, tint, p, shown }: { x: number; at: number; tint: string; p: SharedValue<number>; shown: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    // pops as the bead arrives: 0 → 1.25 → 1 over the last ~8% of the run before it (so the end node lands too)
    const k = Math.max(0, Math.min(1, (p.value - at) / 0.08 + 1));
    const s = k <= 0 ? 0 : k < 0.6 ? (k / 0.6) * 1.25 : 1.25 - ((k - 0.6) / 0.4) * 0.25;
    return { opacity: shown.value * (k > 0 ? 1 : 0), transform: [{ scale: s }] };
  });
  return <Animated.View style={[styles.node, { left: x - NODE / 2, backgroundColor: tint }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { gap: space[2], marginBottom: space[5] },
  track: { height: NODE, justifyContent: 'center', marginHorizontal: NODE / 2 },
  reveal: { position: 'absolute', left: 0, top: 0, height: NODE, overflow: 'hidden' },
  node: { position: 'absolute', top: 0, width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2, borderColor: color.white },
  bead: { position: 'absolute', left: 0, top: -2, width: NODE + 4, height: NODE + 4, marginLeft: -2, borderRadius: (NODE + 4) / 2, backgroundColor: color.white, borderWidth: 3, borderColor: color.primary },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  caption: { fontSize: 15, lineHeight: 21 },
});
