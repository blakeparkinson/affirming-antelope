import type { Setting } from '@antelope/core';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { color } from '@/design';
import { useReduceMotion } from '@/motion';
import { BAND_DEPTH, ridgeLag, SKY_LAG, type Band, type BandPalette, type Motif, type Prop } from './geometry';

const LIFT = 96; // room above each ridge for the hill crests and the birds over them

/** The track's scenery: savanna for leaders (workplace), wetland for clinicians. */
export function motifFor(setting: Setting): Motif {
  return setting === 'clinical' ? 'wetland' : 'savanna';
}

/**
 * Ridge tints. Both tracks share the pale periwinkle horizon and cool ridges and
 * end in the same ochre-tint meadow (arrival is an achievement); the earth tones
 * between are what differ: warm sand on the savanna, pale sage on the wetland.
 */
export const PALETTES: Record<Motif, BandPalette> = {
  savanna: {
    horizon: '#F4F6FF',
    cool: [color.soft, color.softDeep, '#E9EDFD'],
    earth: ['#FCF3E3', '#F7F1E6'],
    meadow: '#FBEED6',
  },
  wetland: {
    horizon: '#F4F6FF',
    cool: [color.soft, color.softDeep, '#E9EDFD'],
    earth: ['#EAF4F1', '#E3EFEB'],
    meadow: '#FBEED6',
  },
};

/**
 * Flat, banded landscape in brand tints. Ridges lag behind the trail more the
 * higher they sit on screen (the horizon is up), and the sun lags most, so it
 * sinks behind the first ridge as you set off (see `ridgeLag`). Each ridge has a
 * light rim along its crest, so the bands read as hills one behind another. Navy
 * appears only as tiny accents: birds, acacias or reeds, a distant herd; everything
 * else is a brand tint. A cloud drifts slowly by the sun (still with reduced motion).
 */
export const Landscape = memo(function Landscape({
  bands,
  width,
  height,
  scrollY,
  viewportH,
}: {
  bands: Band[];
  width: number;
  height: number;
  scrollY: SharedValue<number>;
  viewportH: number;
}) {
  const sky = useAnimatedStyle(() => ({ transform: [{ translateY: Math.min(Math.max(scrollY.value, 0), 600) * SKY_LAG }] }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, sky]}>
        <Sky width={width} />
        {/* in front of the sun's lower left, clear of the trail's start */}
        <Cloud x={width * 0.58} y={186} s={0.9} drift={-12} period={22000} />
      </Animated.View>
      {bands.map((b, i) => (
        <BandLayer key={i} band={b} width={width} scrollY={scrollY} viewportH={viewportH} />
      ))}
    </View>
  );
});

function Sky({ width }: { width: number }) {
  const cx = width * 0.8;
  return (
    <Svg width={width} height={260} style={StyleSheet.absoluteFill}>
      <Circle cx={cx} cy={150} r={64} fill={color.gold} opacity={0.07} />
      <Circle cx={cx} cy={150} r={46} fill={color.gold} opacity={0.14} />
      <Circle cx={cx} cy={150} r={30} fill={color.gold} opacity={0.5} />
      {/* a flat highlight on the sun's upper left, the same light as the ridge rims */}
      <Path d={`M${cx - 21} ${143} A22 22 0 0 1 ${cx - 6} ${128}`} stroke={color.white} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
      <Birds x={width * 0.18} y={170} />
    </Svg>
  );
}

const CLOUD_W = 96;
const CLOUD_H = 34;

/** A flat periwinkle cloud with a white top rim, drifting back and forth by `drift` pt. */
function Cloud({ x, y, s, drift, period }: { x: number; y: number; s: number; drift: number; period: number }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, period, t]);
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * drift }] }));
  return (
    <Animated.View style={[styles.cloud, { left: x, top: y, width: CLOUD_W * s, height: CLOUD_H * s }, move]}>
      <Svg width={CLOUD_W * s} height={CLOUD_H * s} viewBox={`0 0 ${CLOUD_W} ${CLOUD_H}`}>
        <Path d="M8 33 C-2 33 -1 20 10 19 C11 9 26 6 33 13 C38 2 58 1 63 13 C70 7 84 10 84 20 C95 20 97 33 86 33 Z" fill={color.softDeep} />
        <Path d="M12 19 C13 11 25 9 31 14 M37 11 C42 4 55 4 60 12" stroke={color.white} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.9} />
      </Svg>
    </Animated.View>
  );
}

function Birds({ x, y }: { x: number; y: number }) {
  return (
    <G stroke={color.navy} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.55}>
      <Path d={`M${x} ${y} q5 -5 10 0 q5 -5 10 0`} />
      <Path d={`M${x + 26} ${y - 14} q4 -4 8 0 q4 -4 8 0`} />
    </G>
  );
}

function Acacia({ x, y, s = 1, flip }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} opacity={0.85}>
      <Path d="M0 0 L0 -18 M0 -12 L-7 -22 M0 -10 L6 -21" stroke={color.navy} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M-20 -22 C-14 -31 14 -31 20 -22 C12 -19 -12 -19 -20 -22 Z" fill={color.navy} />
    </G>
  );
}

/** A tuft of reeds with one cattail: the wetland's acacia. Same navy weight. */
function Reeds({ x, y, s = 1, flip }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} opacity={0.85}>
      <Path
        d="M-1 0 Q-3 -13 -10 -22 M1 0 Q1 -16 -1 -30 M3 0 Q6 -12 13 -19 M5 0 Q9 -9 17 -11"
        stroke={color.navy}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={-3.4} y={-41} width={5} height={13} rx={2.5} fill={color.navy} />
    </G>
  );
}

/** A still pool: a flat cobalt-tint ellipse with two glints. */
function Pool({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Ellipse cx={0} cy={0} rx={38} ry={8.5} fill={color.primaryTint} opacity={0.75} />
      <Path d="M-20 -1.5 L-6 -1.5 M4 2 L12 2" stroke={color.white} strokeWidth={2} strokeLinecap="round" opacity={0.9} />
    </G>
  );
}

/** A low grass tuft, drawn faint: ground texture, not an object. */
function Tuft({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <Path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-6 0 Q-6 -5 -9 -8 M0 0 Q0 -6 1 -11 M6 0 Q6 -5 9 -7"
      stroke={color.goldShadow}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
      opacity={0.32}
    />
  );
}

/** A round savanna shrub: three overlapping lobes in sand, a darker base. */
function Bush({ x, y, s = 1, flip }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Ellipse cx={0} cy={0} rx={20} ry={3.5} fill={color.goldShadow} opacity={0.22} />
      <Circle cx={-9} cy={-8} r={9} fill={color.goldShadow} opacity={0.42} />
      <Circle cx={7} cy={-9} r={10} fill={color.goldShadow} opacity={0.42} />
      <Circle cx={-1} cy={-15} r={9} fill={color.goldShadow} opacity={0.5} />
      <Path d="M-12 -14 Q-9 -18 -5 -18" stroke={color.white} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
    </G>
  );
}

/** Two flat stones, a big one and a small one, lit along the top. */
function Rock({ x, y, s = 1, flip }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Path d="M-16 0 C-17 -9 -9 -15 -1 -14 C7 -14 12 -8 11 0 Z" fill={color.shadow} />
      <Path d="M-11 -10 C-7 -13 -2 -13 2 -12" stroke={color.white} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.75} />
      <Path d="M10 0 C9 -5 13 -8 17 -7 C21 -6 23 -3 22 0 Z" fill={color.line} />
    </G>
  );
}

/** A termite mound: a lumpy sand spire, the savanna's own landmark. */
function Mound({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Path d="M-15 0 C-13 -9 -9 -14 -8 -22 C-7 -30 -3 -38 0 -39 C3 -38 5 -31 5 -25 C9 -22 8 -15 11 -11 C13 -7 14 -3 15 0 Z" fill={color.goldShadow} opacity={0.32} />
      <Path d="M-4 -30 C-3 -34 -1 -36 0 -36" stroke={color.white} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.6} />
    </G>
  );
}

/** One tiny grazing antelope in silhouette (the brand animal), facing right. */
const ANTELOPE =
  'M-8 -6 C-8 -9 -4 -10 2 -10 C5 -10 7 -11 8 -14 L10 -14 C11 -13 11 -11 10 -10 C9 -8 8 -6 6 -5 L6 0 L4.6 0 L4.4 -4.6 L-4.6 -4.6 L-4.8 0 L-6.2 0 L-6.6 -4.8 C-7.6 -5 -8 -5.4 -8 -6 Z';

/** A distant herd: three antelopes on the horizon, one grazing, in faint navy. */
function Herd({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`} fill={color.navy} opacity={0.45}>
      <Path d={ANTELOPE} />
      <Path d="M9 -14 C9 -18 7 -20 5 -21 M10.5 -14 C11 -18 10 -20 8 -21.5" stroke={color.navy} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <G transform="translate(22 1) scale(0.85)">
        <Path d={ANTELOPE} />
      </G>
      {/* the grazing one, head down */}
      <G transform="translate(-20 1) scale(-0.8 0.8)">
        <Path d="M-8 -6 C-8 -9 -4 -10 2 -10 C5 -10 7 -9 8 -6 C9 -4 10 -2 9 -1 L7 -1 C6 -2 6 -4 5 -5 L5 0 L3.6 0 L3.4 -4.6 L-4.6 -4.6 L-4.8 0 L-6.2 0 L-6.6 -4.8 C-7.6 -5 -8 -5.4 -8 -6 Z" />
      </G>
    </G>
  );
}

function PropShape({ p }: { p: Prop }) {
  switch (p.kind) {
    case 'acacia':
      return <Acacia x={p.x} y={p.y} s={p.s} flip={p.flip} />;
    case 'reeds':
      return <Reeds x={p.x} y={p.y} s={p.s} flip={p.flip} />;
    case 'pool':
      return <Pool x={p.x} y={p.y} s={p.s} />;
    case 'birds':
      return <Birds x={p.x} y={p.y} />;
    case 'tuft':
      return <Tuft x={p.x} y={p.y} s={p.s} />;
    case 'bush':
      return <Bush x={p.x} y={p.y} s={p.s} flip={p.flip} />;
    case 'rock':
      return <Rock x={p.x} y={p.y} s={p.s} flip={p.flip} />;
    case 'mound':
      return <Mound x={p.x} y={p.y} s={p.s} />;
    case 'herd':
      return <Herd x={p.x} y={p.y} s={p.s} />;
  }
}

function BandLayer({
  band,
  width,
  scrollY,
  viewportH,
}: {
  band: Band;
  width: number;
  scrollY: SharedValue<number>;
  viewportH: number;
}) {
  const bandY = band.y;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ridgeLag(bandY, scrollY.value, viewportH) }] }));
  const h = BAND_DEPTH + LIFT;
  return (
    <Animated.View style={[styles.band, { top: band.y - LIFT, width, height: h }, style]}>
      <Svg width={width} height={h}>
        <G transform={`translate(0 ${LIFT})`}>
          <Path d={band.d} fill={band.fill} />
          {/* the lit rim of the crest: what makes one ridge read in front of the next */}
          <Path d={band.crest} stroke={color.white} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
          {band.props.map((p, k) => (
            <PropShape key={k} p={p} />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0 },
  cloud: { position: 'absolute' },
});
