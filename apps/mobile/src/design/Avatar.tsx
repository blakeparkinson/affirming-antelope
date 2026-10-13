import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { color } from './tokens';
import { ageBand, ageFromSeed, settingFromSeed, type AvatarAge, type AvatarAgeBand, type AvatarPresentation, type AvatarSetting } from './personaAge';

/**
 * Deterministic illustrated persona from a seed (Persona.avatarSeed).
 * Flat shapes with the mascot's navy contour, on a soft brand-tint disc.
 * Same seed, same person, everywhere.
 */

const INK = color.navy;
const BACKDROPS = [color.soft, color.goldTint, '#E2F0E8', '#FCE5D8', '#DDEEF8', '#F1ECE2'];
const SKIN = ['#F7D7BE', '#EDBE98', '#D9A273', '#B97E52', '#8F5D3B', '#5F3D27'];
const HAIR = ['#1E1916', '#3A2A1F', '#5E4129', '#8C6239', '#C79A5B', '#9A9AA2'];
const TOPS = [color.primary, color.navy, '#2E8C7E', '#D9704E', '#6A7896', color.gold, '#3F6FB5'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


type HairStyle = 'crop' | 'part' | 'long' | 'bun' | 'curls' | 'buzz' | 'bob' | 'receding' | 'bald' | 'set';
type Collar = 'crew' | 'scrubs' | 'collar' | 'lanyard' | 'cardigan' | 'sweater' | 'hoodie';

export interface AvatarTraits {
  backdrop: string;
  skin: string;
  hair: string;
  top: string;
  hairStyle: HairStyle;
  collar: Collar;
  glasses: boolean;
  earrings: boolean;
  age: AvatarAgeBand;
  /** Reading glasses (rectangular) for older faces; round frames otherwise. */
  glassesStyle: 'round' | 'reading';
  moustache: boolean;
  /** Smile lines from 50; crow's feet and brows join them from 60. */
  lines: 'none' | 'smile' | 'full';
  /** Shirt showing inside a cardigan. */
  inner: string;
}

export interface AvatarOptions {
  age?: AvatarAge;
  setting?: AvatarSetting;
  presentation?: AvatarPresentation;
}

/** Tuned once so the demo cast reads as a varied group of people. Changing it reshuffles everyone. */
const SALT = 39;

/** Each trait draws from its own hash so traits don't correlate. */
function trait(seed: string, key: string) {
  return rng(hash(`${SALT}:${key}:${seed}`))();
}

// Older faces: greys from salt-and-pepper to white; 75 and up skew white.
const GREYS = ['#8D9097', '#B4B7BE', '#CFD1D6', '#E8E5DF'];
const WHITES = ['#CFD1D6', '#E8E5DF', '#F3F1EC'];
// Softer, heathered knitwear for older patients.
const KNITS = ['#8E3B46', '#5E7F6A', '#B5838D', '#5B6B8C', '#C49A5A', '#3F6F86', color.navy, '#7A6A9A'];
const INNERS = [color.white, '#F4EBDD', '#DDE6F5'];
// Patients never wear scrubs or a badge; who wears what shifts with age.
const PATIENT_COLLARS: Record<AvatarAgeBand, readonly Collar[]> = {
  young: ['hoodie', 'hoodie', 'crew', 'crew', 'collar', 'sweater'],
  adult: ['crew', 'crew', 'collar', 'sweater', 'hoodie', 'cardigan'],
  older: ['cardigan', 'cardigan', 'cardigan', 'sweater', 'sweater', 'collar'],
};
// Athletes dress for practice: a hoodie or a tee, never scrubs, a badge, or a button-down.
const ATHLETE_COLLARS: readonly Collar[] = ['hoodie', 'hoodie', 'crew', 'crew'];
const OLDER_STYLES: readonly HairStyle[] = ['receding', 'bald', 'set', 'set', 'bob', 'bun', 'crop', 'part'];
const STYLES_FOR: Record<AvatarPresentation, Record<'older' | 'other', readonly HairStyle[]>> = {
  feminine: { older: ['set', 'set', 'bob', 'bun', 'part'], other: ['part', 'long', 'bun', 'curls', 'bob'] },
  masculine: { older: ['receding', 'bald', 'crop', 'part'], other: ['crop', 'part', 'buzz', 'curls'] },
};

/**
 * Traits for a seed. With no options (adult, workplace) the draw is exactly the original
 * one, so existing seeds keep their faces; age and setting only layer overrides on top,
 * each from its own hash key, so the same seed is the same person at any age.
 */
export function traitsFor(seed: string, opts: AvatarOptions = {}): AvatarTraits {
  const p = <T,>(key: string, xs: readonly T[]) => xs[Math.floor(trait(seed, key) * xs.length)];
  const age = ageBand(opts.age);
  const t: AvatarTraits = {
    backdrop: p('backdrop', BACKDROPS),
    skin: p('skin', SKIN),
    hair: p('hair', HAIR),
    top: p('top', TOPS),
    hairStyle: p('style', ['crop', 'part', 'long', 'bun', 'curls', 'buzz', 'bob'] as const),
    collar: p('collar', ['crew', 'scrubs', 'collar', 'lanyard'] as const),
    glasses: trait(seed, 'glasses') < 0.3,
    earrings: trait(seed, 'earrings') < 0.3,
    age,
    glassesStyle: 'round',
    moustache: false,
    lines: 'none',
    inner: color.white,
  };
  const years = typeof opts.age === 'number' ? opts.age : undefined;
  if (opts.setting === 'clinical') t.collar = p(`pcollar:${age}`, PATIENT_COLLARS[age]);
  if (opts.setting === 'sports') t.collar = p('acollar', ATHLETE_COLLARS);
  if (age === 'older') {
    t.hair = (years ?? 0) >= 75 ? p('ohair', WHITES) : p('ohair', GREYS);
    t.hairStyle = p('ostyle', OLDER_STYLES);
    t.glasses = trait(seed, 'oglasses') < 0.6;
    t.glassesStyle = 'reading';
    t.lines = 'full';
    t.inner = p('inner', INNERS);
    if (opts.setting === 'clinical') t.top = p('knit', KNITS);
  } else if (years !== undefined && years >= 50) {
    // Fifties: smile lines, and some are going grey.
    t.lines = 'smile';
    if (trait(seed, 'mgrey') < 0.4) t.hair = p('mhair', GREYS.slice(0, 2));
  } else if (age === 'young' || (years !== undefined && years < 45)) {
    // Nobody under 45 with a stated age goes grey.
    if (t.hair === HAIR[HAIR.length - 1]) t.hair = p('yhair', HAIR.slice(0, -1));
  }
  if (age === 'young') {
    t.glasses = t.glasses && trait(seed, 'yglasses') < 0.5;
  }
  if (opts.presentation) {
    // Keep the seed's style when it fits; otherwise draw one that does.
    const fits = STYLES_FOR[opts.presentation][age === 'older' ? 'older' : 'other'];
    if (!fits.includes(t.hairStyle)) t.hairStyle = p(`gstyle:${opts.presentation}:${age}`, fits);
  }
  const thinning = t.hairStyle === 'bald' || t.hairStyle === 'receding';
  if (thinning || opts.presentation === 'masculine') t.earrings = false;
  t.moustache = age === 'older' && thinning && opts.presentation !== 'feminine' && trait(seed, 'stache') < 0.45;
  return t;
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const rr = f((n >> 16) & 255), gg = f((n >> 8) & 255), bb = f(n & 255);
  return `#${((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
}

const SW = 2; // contour, matches the mascot's outline weight at 64pt

function HairBack({ t }: { t: AvatarTraits }) {
  if (t.hairStyle === 'long')
    return <Path d="M17 30c0-11 6-18 15-18s15 7 15 18v17c0 3-3 4-6 4H23c-3 0-6-1-6-4V30Z" fill={t.hair} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />;
  if (t.hairStyle === 'bob')
    return <Path d="M18 30c0-10 6-17 14-17s14 7 14 17v8c0 3-2 5-5 5H23c-3 0-5-2-5-5v-8Z" fill={t.hair} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />;
  if (t.hairStyle === 'bun') return <Circle cx={32} cy={11} r={6} fill={t.hair} stroke={INK} strokeWidth={SW} />;
  if (t.hairStyle === 'curls')
    return (
      <G fill={t.hair} stroke={INK} strokeWidth={SW}>
        <Circle cx={20} cy={24} r={6} />
        <Circle cx={44} cy={24} r={6} />
        <Circle cx={22} cy={34} r={5} />
        <Circle cx={42} cy={34} r={5} />
      </G>
    );
  return null;
}

function HairFront({ t }: { t: AvatarTraits }) {
  const p = { fill: t.hair, stroke: INK, strokeWidth: SW, strokeLinejoin: 'round' as const };
  switch (t.hairStyle) {
    case 'crop':
      return <Path d="M19.5 28c-1-9 5-15 12.5-15S45.5 19 44.5 28c-2-4-6-6-12.5-6S21.5 24 19.5 28Z" {...p} />;
    case 'part':
      return <Path d="M19.5 29c-1.5-10 4.5-16 12.5-16 8 0 14 5 12.5 15-4-1-8-4-10-8-3 5-9 8-15 9Z" {...p} />;
    case 'long':
    case 'bob':
      return <Path d="M19.5 30c-1-10 5-17 12.5-17s13.5 7 12.5 17c-5-2-9-6-11-10-2 5-8 9-14 10Z" {...p} />;
    case 'bun':
      return <Path d="M19.5 28c-1-9 5-14 12.5-14s13.5 5 12.5 14c-3-4-7-6-12.5-6S22.5 24 19.5 28Z" {...p} />;
    case 'curls':
      return (
        <G {...p}>
          <Circle cx={24} cy={18} r={6} />
          <Circle cx={32} cy={15} r={6.5} />
          <Circle cx={40} cy={18} r={6} />
          <Circle cx={20} cy={24} r={4.5} />
          <Circle cx={44} cy={24} r={4.5} />
        </G>
      );
    case 'buzz':
      return <Path d="M20 26c0-7 5-12 12-12s12 5 12 12c-3-2-7-3-12-3s-9 1-12 3Z" {...p} />;
    case 'receding':
      // Full at the sides, a high M-shaped hairline over a bare forehead.
      return (
        <Path
          d="M20 28.5c-1-7.5 3.6-13.5 12-13.5s13 6 12 13.5c-1.2-1.6-1.9-3.8-2.1-6.4-.9-1.5-2.4-2.4-4.4-2.6-1.6-.2-3.4-.3-5.5-.3s-3.9.1-5.5.3c-2 .2-3.5 1.1-4.4 2.6-.2 2.6-.9 4.8-2.1 6.4Z"
          {...p}
        />
      );
    case 'bald':
      // Side fringes only, with a highlight on the crown.
      return (
        <G>
          <Path d="M19.6 31.5c-1.2-3.6-.8-7 1.2-9.6.9 2.6 2.2 4.8 4 6.4-2 .8-3.7 1.9-5.2 3.2Z" {...p} />
          <Path d="M44.4 31.5c1.2-3.6.8-7-1.2-9.6-.9 2.6-2.2 4.8-4 6.4 2 .8 3.7 1.9 5.2 3.2Z" {...p} />
          <Path d="M26.5 19.6c1.5-1.3 3.4-2 5.4-2.1" fill="none" stroke={color.white} strokeWidth={1.6} strokeLinecap="round" opacity={0.75} />
        </G>
      );
    case 'set':
      // A short rounded set: small tight curls close to the head.
      return (
        <G {...p}>
          <Circle cx={20.6} cy={27.4} r={3.6} />
          <Circle cx={43.4} cy={27.4} r={3.6} />
          <Circle cx={22.4} cy={21.6} r={4.3} />
          <Circle cx={41.6} cy={21.6} r={4.3} />
          <Circle cx={26.6} cy={17.4} r={4.4} />
          <Circle cx={37.4} cy={17.4} r={4.4} />
          <Circle cx={32} cy={15.8} r={4.6} />
        </G>
      );
  }
}

function Top({ t }: { t: AvatarTraits }) {
  const dark = shade(t.top, 0.78);
  return (
    <G>
      <Path d="M8 66c0-12 10-19 24-19s24 7 24 19" fill={t.top} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      {t.collar === 'scrubs' && <Path d="M26 48l6 8 6-8" fill="none" stroke={dark} strokeWidth={SW + 0.5} strokeLinecap="round" strokeLinejoin="round" />}
      {t.collar === 'collar' && (
        <G fill={color.white} stroke={INK} strokeWidth={1.6} strokeLinejoin="round">
          <Path d="M24.5 48l7.5 6-4 4-5-6Z" />
          <Path d="M39.5 48l-7.5 6 4 4 5-6Z" />
        </G>
      )}
      {t.collar === 'cardigan' && (
        <G>
          <Path d="M24.5 47.8L32 64l7.5-16.2c-2.2 1.4-4.8 2.1-7.5 2.1s-5.3-.7-7.5-2.1Z" fill={t.inner} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <Circle cx={37.4} cy={55.6} r={1} fill={dark} stroke={INK} strokeWidth={0.8} />
          <Circle cx={35.6} cy={60} r={1} fill={dark} stroke={INK} strokeWidth={0.8} />
        </G>
      )}
      {t.collar === 'sweater' && (
        <G>
          <Path d="M25.2 48.4c1.8 2.6 4.1 3.8 6.8 3.8s5-1.2 6.8-3.8" fill="none" stroke={dark} strokeWidth={3.2} strokeLinecap="round" />
          <Path d="M21.5 56v9M42.5 56v9" fill="none" stroke={dark} strokeWidth={1.4} strokeLinecap="round" strokeDasharray="1.6 1.4" />
        </G>
      )}
      {t.collar === 'hoodie' && (
        <G>
          <Path d="M22.6 47.8c.6 5.2 4.6 8.6 9.4 8.6s8.8-3.4 9.4-8.6c-2.7 1.4-5.8 2.2-9.4 2.2s-6.7-.8-9.4-2.2Z" fill={dark} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M29.4 56.2l-.4 5.4M34.6 56.2l.4 5.4" fill="none" stroke={color.white} strokeWidth={1.4} strokeLinecap="round" />
        </G>
      )}
      {t.collar === 'lanyard' && (
        <G>
          <Path d="M25 48l7 11 7-11" fill="none" stroke={color.gold} strokeWidth={2.4} strokeLinecap="round" />
          <Rect x={28.5} y={58} width={7} height={6} rx={1.5} fill={color.white} stroke={INK} strokeWidth={1.4} />
        </G>
      )}
    </G>
  );
}

export interface AvatarProps {
  seed: string;
  size?: number;
  /** Ring in a brand colour, e.g. for the speaking persona. */
  ring?: string;
  accessibilityLabel?: string;
  /**
   * 'young' | 'adult' | 'older', or years (under 25 young, 60+ older; 75+ goes white-haired).
   * Defaults to cues in the seed ("-72", "-older", "-student"), else adult.
   */
  age?: AvatarAge;
  /**
   * 'clinical' dresses the person as a patient (never scrubs or a badge); 'sports' as an
   * athlete in a hoodie or tee. Defaults to 'clinical' for seeds with a "-patient" token, else 'workplace'.
   */
  setting?: AvatarSetting;
  /** Steers hair and facial hair to match the person's pronouns; unset keeps the seed's mix. */
  presentation?: AvatarPresentation;
}

/** What `Avatar` draws for these props: explicit age/setting, else cues in the seed. */
export function avatarTraits(seed: string, opts: AvatarOptions = {}): AvatarTraits {
  return traitsFor(seed, {
    age: opts.age ?? ageFromSeed(seed),
    setting: opts.setting ?? settingFromSeed(seed),
    presentation: opts.presentation,
  });
}

export const Avatar = memo(function Avatar({ seed, size = 48, ring, accessibilityLabel, age, setting, presentation }: AvatarProps) {
  const t = avatarTraits(seed, { age, setting, presentation });
  const older = t.age === 'older';
  const young = t.age === 'young';
  const lineInk = { fill: 'none', stroke: INK, strokeWidth: 1.2, strokeLinecap: 'round' as const, opacity: 0.5 };
  const skinShade = shade(t.skin, 0.86);
  const clipId = `av-${hash(seed).toString(36)}`;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={32} cy={32} r={31} />
          </ClipPath>
        </Defs>
        <Circle cx={32} cy={32} r={31} fill={t.backdrop} />
        <G clipPath={`url(#${clipId})`}>
          <HairBack t={t} />
          <Rect x={27} y={39} width={10} height={11} rx={3} fill={skinShade} stroke={INK} strokeWidth={SW} />
          <Top t={t} />
          {/* ears */}
          <Ellipse cx={19.6} cy={31} rx={2.6} ry={3.4} fill={t.skin} stroke={INK} strokeWidth={SW} />
          <Ellipse cx={44.4} cy={31} rx={2.6} ry={3.4} fill={t.skin} stroke={INK} strokeWidth={SW} />
          {t.earrings && (
            <G fill={color.gold} stroke={INK} strokeWidth={1}>
              <Circle cx={19.4} cy={36} r={1.6} />
              <Circle cx={44.6} cy={36} r={1.6} />
            </G>
          )}
          {older ? (
            // Fuller, softer jaw.
            <Path
              d="M19.5 29.5C19.5 21.5 25 15.5 32 15.5S44.5 21.5 44.5 29.5c0 4.6-.9 8-2.9 10.4-2.3 2.6-5.8 3.6-9.6 3.6s-7.3-1-9.6-3.6c-2-2.4-2.9-5.8-2.9-10.4Z"
              fill={t.skin}
              stroke={INK}
              strokeWidth={SW}
            />
          ) : (
            <Ellipse cx={32} cy={29.5} rx={12.5} ry={14} fill={t.skin} stroke={INK} strokeWidth={SW} />
          )}
          <HairFront t={t} />
          {/* face */}
          <Circle cx={27.3} cy={31} r={young ? 1.85 : 1.7} fill={INK} />
          <Circle cx={36.7} cy={31} r={young ? 1.85 : 1.7} fill={INK} />
          {young && (
            <G fill={color.white}>
              <Circle cx={27.9} cy={30.4} r={0.6} />
              <Circle cx={37.3} cy={30.4} r={0.6} />
            </G>
          )}
          {t.lines === 'full' && (
            // brows in the hair colour, crow's feet
            <G>
              <Path d="M24.6 26.4q2.6-1.3 5.2 0M34.2 26.4q2.6-1.3 5.2 0" fill="none" stroke={shade(t.hair, 0.72)} strokeWidth={1.5} strokeLinecap="round" />
              <Path d="M23.2 30.1l-1.7-.8M23.2 31.9l-1.7.7M40.8 30.1l1.7-.8M40.8 31.9l1.7.7" {...lineInk} />
            </G>
          )}
          {t.lines !== 'none' ? (
            <G>
              <Path d="M26.1 34c-1 1.6-.7 3.4.6 4.6M37.9 34c1 1.6.7 3.4-.6 4.6" {...lineInk} opacity={older ? 0.5 : 0.38} />
              <Ellipse cx={24.2} cy={35.8} rx={1.9} ry={1.2} fill="#F29A84" opacity={0.32} />
              <Ellipse cx={39.8} cy={35.8} rx={1.9} ry={1.2} fill="#F29A84" opacity={0.32} />
            </G>
          ) : (
            <G>
              <Ellipse cx={25} cy={35.4} rx={2.1} ry={1.3} fill="#F29A84" opacity={0.45} />
              <Ellipse cx={39} cy={35.4} rx={2.1} ry={1.3} fill="#F29A84" opacity={0.45} />
            </G>
          )}
          {t.moustache && (
            <Path
              d="M28 35.4c1.4-1.3 2.8-1.5 4-.5 1.2-1 2.6-.8 4 .5-1.2 1.2-2.6 1.4-4 .6-1.4.8-2.8.6-4-.6Z"
              fill={t.hair}
              stroke={INK}
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
          )}
          <Path d="M28.6 36.6c1.9 1.8 4.9 1.8 6.8 0" fill="none" stroke={INK} strokeWidth={1.7} strokeLinecap="round" />
          {t.glasses && t.glassesStyle === 'reading' ? (
            <G fill="none" stroke={INK} strokeWidth={1.5} strokeLinejoin="round">
              <Rect x={23.9} y={29.2} width={6.8} height={4.8} rx={1.6} fill={color.white} fillOpacity={0.2} />
              <Rect x={33.3} y={29.2} width={6.8} height={4.8} rx={1.6} fill={color.white} fillOpacity={0.2} />
              <Path d="M30.7 30.6q1.3-.9 2.6 0M23.9 30.4l-3.4-.8M40.1 30.4l3.4-.8" />
            </G>
          ) : t.glasses && (
            <G fill="none" stroke={INK} strokeWidth={1.5}>
              <Circle cx={27.3} cy={31} r={3.9} />
              <Circle cx={36.7} cy={31} r={3.9} />
              <Path d="M31.2 31h1.6" />
            </G>
          )}
        </G>
        {ring ? <Circle cx={32} cy={32} r={30.5} fill="none" stroke={ring} strokeWidth={2.5} /> : null}
      </Svg>
    </View>
  );
});
