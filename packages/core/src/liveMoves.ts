import { LEARNER_MOVES } from "./prompts/observer";
import type { LearnerMove, Stance, Turn } from "./types";

/*
 * The learner's MI skill, shown as it happens in a role-play.
 *
 * The role-player privately tags how it read each learner line (warmth.ts), and the app
 * pins that move's marker to the learner's bubble. No words, no scores: a shape pops on.
 *
 *   weak     closed questions, information, telling, pushing back, anything else: the
 *            neutral marker, settled in quietly. Never a negative animation.
 *   good     the rest of the MI-consistent moves: the move's own marker, popped.
 *   strong   one bigger moment: a complex reflection, or the line that first draws change
 *            talk out of them. Rationed: a complex reflection can't be strong again until
 *            STRONG_GAP more replies have passed, so it never celebrates every turn.
 */

export type MoveTier = "weak" | "good" | "strong";

export function isLearnerMove(x: unknown): x is LearnerMove {
  return typeof x === "string" && (LEARNER_MOVES as readonly string[]).includes(x);
}

const WEAK: ReadonlySet<LearnerMove> = new Set<LearnerMove>(["closed-question", "giving-information", "advice-without-permission", "confront", "other"]);

/** How much a move deserves on its own, before the conversation's context. */
export function baseTier(move: LearnerMove): Exclude<MoveTier, "strong"> {
  return WEAK.has(move) ? "weak" : "good";
}

/** Learner replies between two complex-reflection moments (so at most every third reply). */
export const STRONG_GAP = 2;

/** One learner line as the chat sees it: its move, and the stance of the reply it drew. */
export interface MoveLine {
  id: string;
  move?: LearnerMove;
  /** The stance the counterpart answered in, once known. */
  drew?: Stance;
}

/**
 * The tier of every classified learner line, in order. Deterministic over the whole
 * transcript, so a line's tier never changes as later lines arrive.
 */
export function liveMoments(lines: MoveLine[]): Record<string, MoveTier> {
  const out: Record<string, MoveTier> = {};
  let changeSeen = false;
  let lastStrong = -Infinity;
  lines.forEach((line, i) => {
    const firstChange = line.drew === "change" && !changeSeen;
    if (line.drew === "change") changeSeen = true;
    if (!line.move) return;
    const base = baseTier(line.move);
    const complex = line.move === "complex-reflection" && i - lastStrong > STRONG_GAP;
    if (base === "good" && (firstChange || complex)) {
      out[line.id] = "strong";
      lastStrong = i;
    } else out[line.id] = base;
  });
  return out;
}

/**
 * The learner lines of a transcript, each with the stance of the counterpart line after it.
 * `drawing` is the reply still arriving: its stance is known (a header) before its words are.
 */
export function moveLines(turns: Turn[], drawing?: { after: string; stance?: Stance }): MoveLine[] {
  const lines: MoveLine[] = [];
  turns.forEach((t, i) => {
    if (t.speaker !== "learner") return;
    const next = turns[i + 1];
    const drew = next?.speaker === "employee" ? next.stance : drawing?.after === t.id ? drawing.stance : undefined;
    lines.push({ id: t.id, move: t.move, drew });
  });
  return lines;
}

/** Gap between markers that arrive together, ms (60-80). */
export const MARKER_STAGGER = 70;

/**
 * When each marker should pop. A marker shows as soon as it arrives unless the one
 * before it popped less than `gap` ago; then it waits its turn. `arrivals` are
 * timestamps in arrival order; `lastShown` is when the previous marker popped.
 */
export function staggerTimes(arrivals: number[], lastShown = -Infinity, gap = MARKER_STAGGER): number[] {
  let prev = lastShown;
  return arrivals.map((at) => (prev = Math.max(at, prev + gap)));
}
