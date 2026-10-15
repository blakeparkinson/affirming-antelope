import type { SkillId } from '@antelope/core';
import type { TextStyle } from 'react-native';

/**
 * Design tokens. Mirrors BRAND.md and apps/web/src/app/globals.css.
 * Never hard-code a colour or radius in a screen; extend these instead.
 */

const SOFT = '#EEF1FF';

export const color = {
  primary: '#4F6BED', // cobalt: primary actions, active learning states
  primaryShadow: '#374FBF', // deep cobalt: pressed, bottom shadow of cobalt surfaces
  primaryTint: '#C9D2FA', // cobalt at ~30% on white: future trail, idle rings
  navy: '#0A284E',
  gold: '#E8A638', // ochre: achievement and emphasis only, never a CTA
  goldShadow: '#B97914',
  goldTint: '#FBEBCB',
  goldInk: '#8A5A0B', // text and glyphs on goldTint / white (5.7:1); never on ochre
  soft: SOFT, // pale periwinkle learning surfaces
  rule: SOFT, // in-card dividers (chrome rules, e.g. dock and tab bar, stay `line`)
  softDeep: '#E2E7FC', // second periwinkle band (landscape, pressed soft surfaces)
  line: '#DFE3F2',
  shadow: '#CBD1E5', // bottom shadow of white surfaces
  ink: '#2E3448',
  muted: '#68708C',
  faint: '#A3AAC2', // locked glyphs, placeholder text (decorative only, not body copy)
  white: '#FFFFFF',
  scrim: 'rgba(10, 40, 78, 0.42)', // navy backdrop for sheets
  // text and chip faces on a cobalt surface (these were white at 82% / 90% / 16%)
  onPrimaryMuted: '#DCE2FF', // overlines on cobalt
  onPrimaryBody: '#F0F3FF', // body copy on cobalt
  onPrimaryChip: '#6A82F0', // chip face on cobalt
  // system notices (a code that didn't work, offline). Warm, never red; never on a learner's practice
  notice: '#B4562B', // text, borders (4.9:1 on white)
  noticeTint: '#FBEDE5', // the cell face behind a notice
} as const;

export type ColorToken = keyof typeof color;

/**
 * Learner-move families (drill feedback, debrief chart markers, tallies). One
 * colour + one shape per family so the chart, legend and counters read as one system.
 * Not red for MI-inconsistent: it's information, not an error.
 */
export const moveColor = {
  question: color.primary,
  reflection: '#2E8C7E', // teal
  support: color.navy,
  inconsistent: '#C46A3F', // warm terracotta
  neutral: color.faint,
} as const;

/**
 * One colour per skill, for its level-up moment (the card's edge, the burst, the Me row's
 * glow). Mid-tone so each reads on white and on `soft`; no red (levelling up is good news).
 */
export const skillTint = {
  oars: color.primary,
  engaging: '#2E8C7E', // teal
  focusing: '#7B61D9', // violet
  evoking: '#D99025', // ochre, a shade deeper than gold so it holds on white
  planning: '#3C8DD0', // sky
  'change-talk': '#3E9F6E', // green
  'sustain-talk': '#C46A3F', // terracotta
  discord: '#C9577E', // rose
  leadership: color.navy,
  'full-conversation': '#5A6FA8', // slate
} as const satisfies Record<SkillId, string>;

/** Debrief replay chart bands (employee stance). */
export const zone = {
  change: color.soft,
  mixed: color.white,
  hold: '#F5F1E8', // warm sand
  holdInk: '#8A7B5C',
} as const;

/**
 * The counterpart's warmth in a role-play (warmth.ts): cold slate for pushback,
 * cool for holding on, the chrome's own line at rest, apricot as they open up.
 * Felt, never read: these only ever tint the portrait and the header's thread.
 */
export const warmth = {
  cold: '#6F86AE',
  cool: '#A3B4D3',
  rest: color.line,
  warm: '#F0A55E',
  /** The soft glow behind a portrait that's opening up. */
  glow: '#FFD3A1',
} as const;

/** 4pt grid. Use these, not raw numbers. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
} as const;

export const radius = {
  sm: 12,
  badge: 12, // step badges, small icon boxes, chips, tab pill
  md: 16,
  surface: 20, // standard surface
  lg: 24,
  illustration: 32,
  pill: 999,
} as const;

export const border = 2;

/** Bottom-shadow depth for raised surfaces. Pressed controls drop to 0. */
export const depth = {
  sm: 3,
  md: 4,
  lg: 5,
  xl: 6,
} as const;

/** Surface tones: face colour, border, and the darker related bottom shadow. */
export const tone = {
  primary: { face: color.primary, border: color.primaryShadow, shadow: color.primaryShadow, ink: color.white },
  surface: { face: color.white, border: color.line, shadow: color.shadow, ink: color.ink },
  soft: { face: color.soft, border: color.line, shadow: color.shadow, ink: color.ink },
  gold: { face: color.gold, border: color.goldShadow, shadow: color.goldShadow, ink: color.navy }, // navy: white on ochre is 2.1:1
  navy: { face: color.navy, border: '#061B36', shadow: '#061B36', ink: color.white },
  /** White control on a cobalt surface. */
  onPrimary: { face: color.white, border: color.white, shadow: color.primaryShadow, ink: color.primary },
  locked: { face: color.soft, border: color.line, shadow: color.line, ink: color.faint },
} as const;

export type Tone = keyof typeof tone;

export const font = {
  display: 'Fredoka_700Bold',
  displaySemi: 'Fredoka_600SemiBold',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
  bodyBlack: 'Nunito_900Black',
} as const;

/**
 * Type scale. Fredoka carries display and headings; Nunito carries everything
 * you read or tap. Sizes are in pt and scale with Dynamic Type (capped in Text).
 */
export const type = {
  hero: { fontFamily: font.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.4 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontFamily: font.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.2 },
  subheading: { fontFamily: font.displaySemi, fontSize: 18, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: font.bodyHeavy, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.bodyHeavy, fontSize: 14, lineHeight: 18 },
  bodySmall: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  bodySmallStrong: { fontFamily: font.bodyHeavy, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: font.bodyBold, fontSize: 13, lineHeight: 17 },
  captionStrong: { fontFamily: font.bodyHeavy, fontSize: 13, lineHeight: 17 },
  tabLabel: { fontFamily: font.bodyHeavy, fontSize: 12, lineHeight: 14 },
  overline: { fontFamily: font.bodyHeavy, fontSize: 13, lineHeight: 16, letterSpacing: 0.2 },
  button: { fontFamily: font.bodyBlack, fontSize: 16, lineHeight: 20, letterSpacing: 0.9 },
  buttonSentence: { fontFamily: font.bodyBlack, fontSize: 16, lineHeight: 22 }, // secondary buttons, sentence case
  number: { fontFamily: font.display, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Content insets. Screens use gutter on both sides. */
export const layout = {
  gutter: 20,
  maxWidth: 520,
  tabBarHeight: 64, // excluding the bottom safe area
  minHit: 44,
} as const;
