import type { Stance, Turn, TurnAnnotation } from "./types";

/*
 * The counterpart's emotional temperature, turn by turn.
 *
 * The role-player opens every reply with a private stance tag ("[change] I mean..."),
 * which the API strips and sends as a header. The app turns that stance into how the
 * portrait sits and how warm the conversation's thread glows. The learner never sees
 * a stance name or an MI term while they talk: only the person opening up or closing down.
 */

export const STANCES: readonly Stance[] = ["sustain", "ambivalent", "change", "discord"];

export function isStance(x: unknown): x is Stance {
  return typeof x === "string" && (STANCES as readonly string[]).includes(x);
}

/** Longest leading tag worth waiting for ("[ambivalent]" is 12). */
const MAX_TAG = 16;

export type StanceTagParse =
  /** Too little text yet to tell whether a tag is coming: keep buffering. */
  | { done: false }
  /** `text` is everything after the tag (or all of it, if there was none). */
  | { done: true; stance?: Stance; text: string };

/**
 * Reads the private stance tag off the front of a reply as it streams in.
 * Any leading single-word bracket tag is stripped, known or not, so a stray
 * "[neutral]" never reaches the learner; only the four stances count.
 */
export function parseStanceTag(head: string, final = false): StanceTagParse {
  const lead = head.trimStart();
  const m = /^\[\s*([A-Za-z-]{1,14})\s*\]\s*/.exec(lead);
  if (m) {
    const word = m[1].toLowerCase();
    return { done: true, stance: isStance(word) ? word : undefined, text: lead.slice(m[0].length) };
  }
  // could still become a tag: "", "[", "[chan"
  const partial = lead === "" || (lead.startsWith("[") && !lead.includes("]") && lead.length <= MAX_TAG && /^\[\s*[A-Za-z-]*\s*$/.test(lead));
  if (partial && !final) return { done: false };
  return { done: true, text: partial ? "" : head };
}

/** The tag the role-player wrote, for replaying a past reply back to it. */
export function stanceTag(stance: Stance): string {
  return `[${stance}]`;
}

export type PresenceKey = Stance | "neutral";

/**
 * How the portrait carries a stance. Numbers are targets; the app springs between
 * them on the UI thread (and only cross-fades colour under reduced motion).
 */
export interface StanceVisual {
  key: PresenceKey;
  /** -1 cold ... +1 warm: the tint over the portrait and the colour of the warmth thread. */
  warmth: number;
  /** Portrait scale: above 1 leans in, below 1 sits back. */
  scale: number;
  /** Vertical offset, pt; negative rises toward you. */
  lift: number;
  /** Head tilt at rest, degrees. */
  tilt: number;
  /** Idle sway either side, degrees (0 = still). */
  sway: number;
  /** Horizontal scale: below 1 draws the shoulders in, arms crossed. */
  squeeze: number;
  /** A quick flinch as the line lands. */
  recoil: boolean;
  /** The soft glow behind the portrait, 0..1. */
  glow: number;
}

const VISUAL: Record<PresenceKey, StanceVisual> = {
  change: { key: "change", warmth: 1, scale: 1.08, lift: -1.5, tilt: 3, sway: 0, squeeze: 1, recoil: false, glow: 1 },
  ambivalent: { key: "ambivalent", warmth: 0, scale: 1, lift: 0, tilt: 0, sway: 2.5, squeeze: 1, recoil: false, glow: 0 },
  sustain: { key: "sustain", warmth: -0.5, scale: 0.95, lift: 1.5, tilt: 0, sway: 0, squeeze: 1, recoil: false, glow: 0 },
  discord: { key: "discord", warmth: -1, scale: 0.93, lift: 1, tilt: -2, sway: 0, squeeze: 0.94, recoil: true, glow: 0 },
  neutral: { key: "neutral", warmth: 0, scale: 1, lift: 0, tilt: 0, sway: 0, squeeze: 1, recoil: false, glow: 0 },
};

/** The visual for a stance. Anything unknown or missing is neutral: at rest, no tint. */
export function stanceVisual(stance: unknown): StanceVisual {
  return VISUAL[isStance(stance) ? stance : "neutral"];
}

export interface WarmthPoint {
  turnId: string;
  /** Warmth after this line, -1..1 (0 when the stance isn't known). */
  warmth: number;
  stance?: Stance;
}

/**
 * The warmth thread for a finished conversation: one point per counterpart line.
 * Each line uses the stance it was played in, else the reviewer's read of it,
 * else (the opening line) the scenario's starting stance.
 */
export function warmthArc(turns: Turn[], opts: { start?: Stance; annotations?: TurnAnnotation[] } = {}): WarmthPoint[] {
  const read = new Map<string, Stance>();
  for (const a of opts.annotations ?? []) if (isStance(a.stance)) read.set(a.turnId, a.stance);
  const points: WarmthPoint[] = [];
  turns.forEach((t, i) => {
    if (t.speaker !== "employee") return;
    const stance = isStance(t.stance) ? t.stance : (read.get(t.id) ?? (i === 0 ? opts.start : undefined));
    points.push({ turnId: t.id, warmth: stanceVisual(stance).warmth, stance });
  });
  return points;
}
