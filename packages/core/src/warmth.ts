import { isLearnerMove } from "./liveMoves";
import type { LearnerMove, Stance, Turn, TurnAnnotation } from "./types";

/*
 * The counterpart's emotional temperature, turn by turn.
 *
 * The role-player opens every reply with private tags ("[open-question] [change] I mean..."),
 * which the API strips and sends as headers. The app turns that stance into how the
 * portrait sits and how warm the conversation's thread glows. The learner never sees
 * a stance name or an MI term while they talk: only the person opening up or closing down.
 */

export const STANCES: readonly Stance[] = ["sustain", "ambivalent", "change", "discord"];

export function isStance(x: unknown): x is Stance {
  return typeof x === "string" && (STANCES as readonly string[]).includes(x);
}

/** Longest leading tag worth waiting for ("[advice-without-permission]" is 27). */
const MAX_TAG = 30;
/** The role-player writes a move tag, then a stance tag; anything past two is the reply. */
const MAX_TAGS = 2;
const TAG = /^\[\s*([A-Za-z][A-Za-z _-]{0,27}?)\s*\]\s*/;

export type StanceTagParse =
  /** Too little text yet to tell whether a tag is coming: keep buffering. */
  | { done: false }
  /**
   * `text` is everything after the tags (or all of it, if there were none).
   * `move` is the role-player's private read of the learner's last line (liveMoves.ts),
   * present only when it wrote one.
   */
  | { done: true; stance?: Stance; move?: LearnerMove; text: string };

/**
 * Reads the private tags off the front of a reply as it streams in: the learner's
 * move, then the stance ("[complex-reflection] [change] I mean..."), either one alone,
 * in either order. Any leading single-word bracket tag is stripped, known or not, so a
 * stray "[neutral]" never reaches the learner; only real stances and moves count.
 */
export function parseStanceTag(head: string, final = false): StanceTagParse {
  let rest = head.trimStart();
  let stance: Stance | undefined;
  let move: LearnerMove | undefined;
  let tags = 0;
  let m: RegExpExecArray | null;
  while (tags < MAX_TAGS && (m = TAG.exec(rest))) {
    // "[Complex Reflection]" and "[open_question]" are the same tag as "[complex-reflection]"
    const word = m[1].toLowerCase().replace(/[\s_]+/g, "-");
    // a several-word bracket counts only when it names a real tag: "[I know] ..." is the reply
    if (/[\s_]/.test(m[1]) && !isStance(word) && !isLearnerMove(word)) break;
    if (isStance(word)) stance = word;
    else if (isLearnerMove(word)) move = word;
    rest = rest.slice(m[0].length);
    tags++;
  }
  // could still become a tag: "", "[", "[chan"
  const partial = tags < MAX_TAGS && (rest === "" || (rest.startsWith("[") && !rest.includes("]") && rest.length <= MAX_TAG && /^\[\s*[A-Za-z _-]*$/.test(rest)));
  if (partial && !final && !(tags > 0 && rest === "")) return { done: false };
  if (!tags) return { done: true, text: partial ? "" : head };
  return { done: true, stance, ...(move ? { move } : {}), text: partial ? "" : rest };
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
