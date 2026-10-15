import { LANDSCAPE_TINTS, type Setting } from '@antelope/core';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';
import { color } from '@/design';
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
// the hexes live in core, where the caption-contrast tests check them under every light
export const PALETTES: Record<Motif, BandPalette> = {
  savanna: {
    horizon: LANDSCAPE_TINTS.horizon,
    cool: [...LANDSCAPE_TINTS.cool],
    earth: [...LANDSCAPE_TINTS.savannaEarth],
    meadow: LANDSCAPE_TINTS.meadow,
  },
  wetland: {
    horizon: LANDSCAPE_TINTS.horizon,
    cool: [...LANDSCAPE_TINTS.cool],
    earth: [...LANDSCAPE_TINTS.wetlandEarth],
    meadow: LANDSCAPE_TINTS.meadow,
  },
};

/**
 * Flat, banded landscape in brand tints. Ridges lag behind the trail more the
 * higher they sit on screen (the horizon is up), and the sun lags most, so it
 * sinks behind the first ridge as you set off (see `ridgeLag`). Navy appears
 * only as tiny accents: a few birds, a few acacias or reeds. `sky` is what hangs in the sky
 * layer (the sun or moon, see Daylight), lagging with it.
 */
export const Landscape = memo(function Landscape({
  bands,
  width,
  height,
  scrollY,
  viewportH,
  sky,
}: {
  bands: Band[];
  width: number;
  height: number;
  scrollY: SharedValue<number>;
  viewportH: number;
  sky?: ReactNode;
}) {
  const skyLag = useAnimatedStyle(() => ({ transform: [{ translateY: Math.min(Math.max(scrollY.value, 0), 600) * SKY_LAG }] }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, skyLag]}>
        {sky}
        <Sky width={width} />
      </Animated.View>
      {bands.map((b, i) => (
        <BandLayer key={i} band={b} width={width} scrollY={scrollY} viewportH={viewportH} />
      ))}
    </View>
  );
});

function Sky({ width }: { width: number }) {
  return (
    <Svg width={width} height={260} style={StyleSheet.absoluteFill}>
      <Birds x={width * 0.18} y={170} />
    </Svg>
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
});
