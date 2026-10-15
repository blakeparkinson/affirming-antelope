import { forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Hoofprint } from '@/design/icons';
import { color } from '@/design/tokens';
import { useReduceMotion } from './useMotionPrefs';

/**
 * Particle burst for achievement peaks (stamp landing, goal ring closing,
 * target hit). Pure UI thread: one shared clock drives every particle, and
 * each particle's position is the closed-form solution of motion under
 * gravity with linear drag, so there's no per-frame JS and no integration drift.
 *
 *   v' = g - k·v   →   x(t) = vx·(1 - e^(-kt)) / k
 *                      y(t) = g·t/k + (vy - g/k)·(1 - e^(-kt)) / k
 *
 * Place it inside the element it bursts from; it centres itself and draws
 * outside its box. Call `fire()` on the visual peak (the same frame as the haptic).
 * `particles="hoofprints"` (streak moments) throws little cloven prints instead of
 * confetti: each points the way it was thrown and barely spins, like tracks scattering.
 * Reduced motion: renders nothing.
 */
export interface BurstHandle {
  fire: () => void;
}

export interface BurstProps {
  /** Number of particles. 10-16 for a small moment, 22-28 for a big one. */
  count?: number;
  /** Launch speed scale. 1 ≈ 90pt reach. */
  power?: number;
  /** Lifetime, ms. */
  duration?: number;
  /** Brand palette; ochre leads (achievement), cobalt accents. */
  colors?: string[];
  /** Cone of launch directions, degrees either side of straight up. 180 = all round. */
  spread?: number;
  /** Particle size scale. */
  scale?: number;
  /** Confetti (dots, diamonds, dashes), hoofprints for streak moments, or soft dust puffs for footfalls. */
  particles?: 'confetti' | 'hoofprints' | 'dust';
  style?: StyleProp<ViewStyle>;
}

const PALETTE = [color.gold, color.gold, color.gold, color.goldShadow, color.primary, color.primaryTint];
const G = 1500; // pt/s²
const K = 4.6; // drag, 1/s
const DUST_G = 140; // dust hangs in the air

type Shape = 'dot' | 'diamond' | 'dash' | 'hoof' | 'puff';
interface Particle {
  vx: number;
  vy: number;
  size: number;
  tint: string;
  shape: Shape;
  spin: number;
  /** Resting rotation, degrees (hoofprints face their launch direction). */
  heading: number;
}

function makeParticles(n: number, power: number, spread: number, scale: number, colors: string[], kind: BurstProps['particles']): Particle[] {
  const hooves = kind === 'hoofprints';
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    // even angular coverage with jitter, so bursts never clump on one side
    const a = (((i + 0.5) / n) * 2 - 1) * spread + (Math.random() - 0.5) * (spread / n) * 1.6;
    const rad = ((a - 90) * Math.PI) / 180;
    const speed = (520 + Math.random() * 420) * power;
    const r = Math.random();
    const shape: Shape = hooves ? 'hoof' : kind === 'dust' ? 'puff' : r < 0.5 ? 'dot' : r < 0.8 ? 'diamond' : 'dash';
    out.push({
      vx: Math.cos(rad) * speed,
      vy: Math.sin(rad) * speed,
      size: (shape === 'hoof' ? 13 + Math.random() * 7 : shape === 'puff' ? 7 + Math.random() * 6 : shape === 'dash' ? 4 : 5 + Math.random() * 4) * scale,
      tint: colors[i % colors.length],
      shape,
      // a print points along its throw (toes first) and only wobbles; confetti tumbles
      spin: shape === 'hoof' ? (Math.random() - 0.5) * 90 : shape === 'puff' ? 0 : (Math.random() - 0.5) * 720,
      heading: shape === 'hoof' ? a : 0,
    });
  }
  return out;
}

export const Burst = forwardRef<BurstHandle, BurstProps>(function Burst(
  { count = 14, power = 1, duration = 640, colors = PALETTE, spread = 75, scale = 1, particles = 'confetti', style },
  ref,
) {
  const reduce = useReduceMotion();
  const t = useSharedValue(0);
  const [shot, setShot] = useState<{ key: number; particles: Particle[] } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      fire: () => {
        if (reduce) return;
        setShot({ key: Date.now(), particles: makeParticles(count, power, spread, scale, colors, particles) });
        t.value = 0;
        t.value = withTiming(duration / 1000, { duration, easing: Easing.linear });
      },
    }),
    [reduce, count, power, spread, scale, colors, duration, particles, t],
  );

  if (!shot) return null;
  const life = duration / 1000;
  return (
    <View pointerEvents="none" style={[styles.origin, style]}>
      {shot.particles.map((p, i) => (
        <Dot key={`${shot.key}-${i}`} p={p} t={t} life={life} g={particles === 'dust' ? DUST_G : G} />
      ))}
    </View>
  );
});

function Dot({ p, t, life, g }: { p: Particle; t: SharedValue<number>; life: number; g: number }) {
  const puff = p.shape === 'puff';
  const style = useAnimatedStyle(() => {
    const s = t.value;
    const e = 1 - Math.exp(-K * s);
    const x = (p.vx * e) / K;
    const y = (g * s) / K + ((p.vy - g / K) * e) / K;
    const u = s / life;
    const grow = Math.min(1, u / 0.08);
    // dust swells as it drifts and thins out; confetti shrinks as it falls
    const opacity = puff ? 0.75 * (1 - u) : u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4);
    const size = puff ? grow * (0.7 + 0.8 * u) : grow * (1 - 0.45 * u);
    return {
      opacity: s <= 0 ? 0 : opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${(p.heading + p.spin * s + (p.shape === 'diamond' ? 45 : 0)).toFixed(2)}deg` },
        { scale: size },
      ],
    };
  });
  if (p.shape === 'hoof') {
    return (
      <Animated.View style={[styles.p, { width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2 }, style]}>
        <Hoofprint size={p.size} tint={p.tint} />
      </Animated.View>
    );
  }
  const w = p.shape === 'dash' ? p.size * 2.6 : p.size;
  return (
    <Animated.View
      style={[
        styles.p,
        { width: w, height: p.size, marginLeft: -w / 2, marginTop: -p.size / 2, backgroundColor: p.tint, borderRadius: p.shape === 'dot' || p.shape === 'puff' ? p.size / 2 : p.shape === 'dash' ? p.size / 2 : 1.5 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, overflow: 'visible', zIndex: 10 },
  p: { position: 'absolute', left: 0, top: 0 },
});
