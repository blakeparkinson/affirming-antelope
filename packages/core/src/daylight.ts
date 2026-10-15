/*
 * The Path's light by the learner's local time: soft dawn, bright day, warm dusk, cool night.
 *
 * Each phase is a sky (top and horizon colours), a wash laid over the landscape (a colour at
 * some opacity), and the colours for the text that sits on the landscape (the week captions).
 * The text is chosen per phase so every caption keeps WCAG AA (4.5:1) on every ridge fill
 * under that phase's wash, and during a cross-fade from any lighter phase (see `textPhaseFor`).
 */

export type DayPhase = "dawn" | "day" | "dusk" | "night";
export const DAY_PHASES: readonly DayPhase[] = ["dawn", "day", "dusk", "night"];

/** Local hour each phase starts. Night runs past midnight to dawn. */
export const PHASE_START: Record<DayPhase, number> = { dawn: 5, day: 8, dusk: 17, night: 20 };

/** Lightest to darkest wash. Text switches to a darker palette at once, to a lighter one after the fade. */
export const PHASE_RANK: Record<DayPhase, number> = { day: 0, dawn: 1, dusk: 2, night: 3 };

/** How long the landscape cross-fades from one phase to the next, ms. */
export const DAYLIGHT_FADE = 1600;

export interface PathText {
  /** Week titles. */
  ink: string;
  /** Locked weeks, subtitles, the finish caption. */
  muted: string;
  /** "Week N" over a finished week. */
  complete: string;
  /** "Week N" over the current week. */
  current: string;
}

export interface Daylight {
  sky: { top: string; horizon: string };
  wash: { color: string; alpha: number };
  text: PathText;
  /** Sun or moon on the sky, as fractions of the width and pt down the canvas. */
  body: { kind: "sun" | "moon"; x: number; y: number; r: number; color: string; glow: string; opacity: number; glowOpacity: number };
  /** Twinkling stars in the sky strip (night only). */
  stars: boolean;
}

export const DAYLIGHT: Record<DayPhase, Daylight> = {
  dawn: {
    sky: { top: "#F6E6F0", horizon: "#FFE8D6" },
    wash: { color: "#F59AB0", alpha: 0.11 },
    text: { ink: "#2E3448", muted: "#545B76", complete: "#7A4F08", current: "#374FBF" },
    body: { kind: "sun", x: 0.3, y: 196, r: 30, color: "#FFB37A", glow: "#FFD2B0", opacity: 0.6, glowOpacity: 0.35 },
    stars: false,
  },
  day: {
    sky: { top: "#FFFFFF", horizon: "#F4F6FF" },
    wash: { color: "#FFFFFF", alpha: 0 },
    text: { ink: "#2E3448", muted: "#5C6480", complete: "#8A5A0B", current: "#374FBF" },
    body: { kind: "sun", x: 0.8, y: 150, r: 28, color: "#E8A638", glow: "#E8A638", opacity: 0.22, glowOpacity: 0.16 },
    stars: false,
  },
  dusk: {
    sky: { top: "#E9D3EA", horizon: "#FFD4B0" },
    wash: { color: "#F2852E", alpha: 0.14 },
    text: { ink: "#2E3448", muted: "#545B76", complete: "#7A4F08", current: "#374FBF" },
    body: { kind: "sun", x: 0.76, y: 200, r: 32, color: "#F27A45", glow: "#FFB98F", opacity: 0.6, glowOpacity: 0.35 },
    stars: false,
  },
  night: {
    sky: { top: "#1B2550", horizon: "#3A4676" },
    wash: { color: "#2B3C93", alpha: 0.24 },
    text: { ink: "#232838", muted: "#3F4660", complete: "#5C3A04", current: "#283C9A" },
    body: { kind: "moon", x: 0.78, y: 168, r: 18, color: "#F4F1DE", glow: "#8E98C4", opacity: 0.95, glowOpacity: 0.22 },
    stars: true,
  },
};

/** The phase for a local time, as fractional hours (0..24). */
export function dayPhase(hours: number): DayPhase {
  const h = ((hours % 24) + 24) % 24;
  if (h >= PHASE_START.night || h < PHASE_START.dawn) return "night";
  if (h >= PHASE_START.dusk) return "dusk";
  if (h >= PHASE_START.day) return "day";
  return "dawn";
}

export function phaseAt(date: Date): DayPhase {
  return dayPhase(date.getHours() + date.getMinutes() / 60);
}

/** The next moment the phase changes after `date` (local time). */
export function nextPhaseChange(date: Date): Date {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const starts = DAY_PHASES.map((p) => PHASE_START[p]).sort((a, b) => a - b);
  const next = starts.find((s) => s > h);
  const out = new Date(date);
  out.setMinutes(0, 0, 0);
  if (next === undefined) {
    out.setDate(out.getDate() + 1);
    out.setHours(starts[0]);
  } else out.setHours(next);
  return out;
}

/**
 * Which phase's text colours to show while the light fades from `from` to `to`: the darker
 * of the two, so captions never sit on a background darker than their palette was checked on.
 */
export function textPhaseFor(from: DayPhase, to: DayPhase): DayPhase {
  return PHASE_RANK[to] >= PHASE_RANK[from] ? to : from;
}

// ---------------------------------------------------------------- contrast

/**
 * Ridge fills on the Path (both motifs) and the bare sky: what week captions can sit on.
 * The app's Landscape builds its palettes from these.
 */
export const LANDSCAPE_TINTS = {
  horizon: "#F4F6FF",
  cool: ["#EEF1FF", "#E2E7FC", "#E9EDFD"],
  savannaEarth: ["#FCF3E3", "#F7F1E6"],
  wetlandEarth: ["#EAF4F1", "#E3EFEB"],
  meadow: "#FBEED6",
} as const;

export function landscapeFills(): string[] {
  const t = LANDSCAPE_TINTS;
  return ["#FFFFFF", t.horizon, ...t.cool, ...t.savannaEarth, ...t.wetlandEarth, t.meadow];
}

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();

/** `top` laid over `base` at `alpha` (normal blending). */
export function blendHex(base: string, top: string, alpha: number): string {
  const a = rgb(base);
  const b = rgb(top);
  return toHex(a.map((v, i) => v * (1 - alpha) + b[i] * alpha));
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** A fill as it shows under a phase's wash. */
export function litFill(fill: string, phase: DayPhase): string {
  const w = DAYLIGHT[phase].wash;
  return blendHex(fill, w.color, w.alpha);
}
