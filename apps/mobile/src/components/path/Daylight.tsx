import { DAY_PHASES, DAYLIGHT, DAYLIGHT_FADE, textPhaseFor, type DayPhase, type PathText } from '@antelope/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useDayPhase } from '@/state/useDayPhase';

/*
 * The Path lit by local time (see @antelope/core daylight): a sky behind the ridges, a sun or
 * moon that sinks with the sky's parallax, a wash over the landscape (under the trail, so the
 * path itself stays bright), and caption colours that keep AA under each wash.
 *
 * Every phase is drawn as its own layer with a weight (0..1); a change of phase cross-fades
 * the weights over DAYLIGHT_FADE. Captions switch to the darker palette at the start of a fade
 * toward a darker phase and to the lighter one only once a fade toward a lighter phase is done.
 * Reduced motion: no fade (the new light is simply there) and the stars hold still.
 */

export interface Lighting {
  phase: DayPhase;
  /** Colours for the text that sits on the landscape. */
  text: PathText;
  weights: Record<DayPhase, SharedValue<number>>;
}

/** Sky backdrop depth, pt from the top of the canvas: down past the first ridge. */
const SKY_H = 420;

export function useLighting(reduce: boolean): Lighting {
  const phase = useDayPhase();
  const dawn = useSharedValue(phase === 'dawn' ? 1 : 0);
  const day = useSharedValue(phase === 'day' ? 1 : 0);
  const dusk = useSharedValue(phase === 'dusk' ? 1 : 0);
  const night = useSharedValue(phase === 'night' ? 1 : 0);
  const weights = useMemo(() => ({ dawn, day, dusk, night }), [dawn, day, dusk, night]);

  const [textPhase, setTextPhase] = useState(phase);
  const shown = useRef(phase);
  useEffect(() => {
    const from = shown.current;
    if (from === phase) return;
    shown.current = phase;
    for (const p of DAY_PHASES) {
      const to = p === phase ? 1 : 0;
      weights[p].value = reduce ? to : withTiming(to, { duration: DAYLIGHT_FADE, easing: Easing.inOut(Easing.quad) });
    }
    if (reduce) {
      setTextPhase(phase);
      return;
    }
    setTextPhase(textPhaseFor(from, phase));
    const t = setTimeout(() => setTextPhase(phase), DAYLIGHT_FADE);
    return () => clearTimeout(t);
  }, [phase, reduce, weights]);

  return { phase, text: DAYLIGHT[textPhase].text, weights };
}

function Layer({ weight, children, style }: { weight: SharedValue<number>; children: React.ReactNode; style?: object }) {
  const a = useAnimatedStyle(() => ({ opacity: weight.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style, a]}>
      {children}
    </Animated.View>
  );
}

/** Sky colours behind the ridges, one gradient per phase. Static (the colour fills the sky; no parallax). */
export function SkyBackdrop({ light, width }: { light: Lighting; width: number }) {
  return (
    <View pointerEvents="none" style={[styles.sky, { width, height: SKY_H }]}>
      {DAY_PHASES.map((p) => (
        <Layer key={p} weight={light.weights[p]}>
          <Svg width={width} height={SKY_H}>
            <Defs>
              <LinearGradient id={`sky-${p}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={DAYLIGHT[p].sky.top} />
                <Stop offset="0.55" stopColor={DAYLIGHT[p].sky.horizon} />
                <Stop offset="1" stopColor={DAYLIGHT[p].sky.horizon} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={SKY_H} fill={`url(#sky-${p})`} />
          </Svg>
        </Layer>
      ))}
    </View>
  );
}

/** The phase's wash over the landscape and landmarks, under the trail and the captions. */
export function Wash({ light, height }: { light: Lighting; height: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      {DAY_PHASES.filter((p) => DAYLIGHT[p].wash.alpha > 0).map((p) => (
        <Layer key={p} weight={light.weights[p]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: DAYLIGHT[p].wash.color, opacity: DAYLIGHT[p].wash.alpha }]} />
        </Layer>
      ))}
    </View>
  );
}

/**
 * Sun (or moon and stars) in the sky. Goes inside the Landscape's sky layer so it lags the
 * scroll with it and sets behind the first ridge. `top` is the header's height: the stars
 * keep to the strip of sky below it.
 */
export function Celestial({ light, width, top, still }: { light: Lighting; width: number; top: number; still: boolean }) {
  return (
    <>
      {DAY_PHASES.map((p) => {
        const b = DAYLIGHT[p].body;
        const cx = width * b.x;
        return (
          <Layer key={p} weight={light.weights[p]}>
            <Svg width={width} height={SKY_H}>
              <Circle cx={cx} cy={b.y} r={b.r * 1.65} fill={b.glow} opacity={b.glowOpacity} />
              <Circle cx={cx} cy={b.y} r={b.r} fill={b.color} opacity={b.opacity} />
              {b.kind === 'moon' ? (
                <>
                  <Circle cx={cx - b.r * 0.35} cy={b.y - b.r * 0.2} r={b.r * 0.22} fill="#DCD8C2" />
                  <Circle cx={cx + b.r * 0.3} cy={b.y + b.r * 0.35} r={b.r * 0.14} fill="#DCD8C2" />
                </>
              ) : null}
            </Svg>
            {DAYLIGHT[p].stars ? <Stars width={width} top={top} still={still || p !== light.phase} /> : null}
          </Layer>
        );
      })}
    </>
  );
}

// a few stars, placed by hand across the sky strip (fractions of the width, pt below the header)
const STARS = [
  { x: 0.08, y: 14, r: 1.6, k: 0.0 },
  { x: 0.21, y: 44, r: 1.2, k: 0.37 },
  { x: 0.34, y: 10, r: 1.9, k: 0.71 },
  { x: 0.47, y: 52, r: 1.3, k: 0.18 },
  { x: 0.58, y: 22, r: 1.5, k: 0.55 },
  { x: 0.66, y: 60, r: 1.1, k: 0.9 },
  { x: 0.92, y: 18, r: 1.7, k: 0.28 },
  { x: 0.95, y: 64, r: 1.2, k: 0.63 },
];

function Stars({ width, top, still }: { width: number; top: number; still: boolean }) {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (still) {
      cancelAnimation(clock);
      return;
    }
    clock.value = withRepeat(withTiming(clock.value + 1, { duration: 3600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [still, clock]);
  return (
    <>
      {STARS.map((s, i) => (
        <Star key={i} left={width * s.x} top={top + s.y} r={s.r} k={s.k} clock={clock} />
      ))}
    </>
  );
}

function Star({ left, top, r, k, clock }: { left: number; top: number; r: number; k: number; clock: SharedValue<number> }) {
  const a = useAnimatedStyle(() => {
    // each star twinkles on its own beat: a slow swell and a quick dip
    const u = (clock.value + k) % 1;
    const tw = 0.5 + 0.5 * Math.cos(2 * Math.PI * u);
    return { opacity: 0.45 + 0.55 * tw * tw, transform: [{ scale: 0.8 + 0.3 * tw }] };
  });
  const d = r * 2;
  return <Animated.View style={[styles.star, { left: left - r, top: top - r, width: d, height: d, borderRadius: r }, a]} />;
}

const styles = StyleSheet.create({
  sky: { position: 'absolute', left: 0, top: 0 },
  star: { position: 'absolute', backgroundColor: '#FFF8E0' },
});
