import { SKILLS } from "./skills";
import type { DemoSkillProgress } from "./demo";
import type { SkillId, SkillLevelNumber } from "./types";

/**
 * Spaced review. A practised skill fades as the days pass since it was last practised,
 * and comes back for a refresh. Sharpness (0..1) is derived, never stored: it reads
 * `lastPracticedAt` and the level, and never touches either, so fading can't cost a level.
 *
 * The curve is a half-life: sharpness = 0.5 ^ (days / halfLife). It's gentle (a level 1
 * skill is still 93% sharp the day after) and slower at higher levels, which have been
 * practised more: each level stretches the half-life by `SHARP_LEVEL_STRETCH`.
 *
 *   level      1     2     3      4     5     6
 *   half-life  10d   15d   22.5d  34d   51d   76d
 *   fades at   ~7d   ~11d  ~17d   ~25d  ~37d  ~56d   (below FADED_BELOW)
 */

/** A level 1 skill's half-life, in days. */
export const SHARP_HALF_LIFE_DAYS = 10;
/** Each level above 1 multiplies the half-life by this. */
export const SHARP_LEVEL_STRETCH = 1.5;
/** Below this a practised skill counts as faded: Home asks for a refresh. */
export const FADED_BELOW = 0.6;

const DAY_MS = 86_400_000;

export type SharpnessInput = Pick<DemoSkillProgress, "level" | "status" | "lastPracticedAt">;

export function halfLifeDays(level: SkillLevelNumber): number {
  return SHARP_HALF_LIFE_DAYS * SHARP_LEVEL_STRETCH ** (Math.max(1, level) - 1);
}

const ms = (t: Date | string | number) => (t instanceof Date ? t.getTime() : typeof t === "string" ? Date.parse(t) : t);

/** Whole days since the skill was last practised (0 on the day), or null if it never was. */
export function daysSincePracticed(p: SharpnessInput | undefined, now: Date | string | number): number | null {
  const at = p?.lastPracticedAt ? Date.parse(p.lastPracticedAt) : NaN;
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((ms(now) - at) / DAY_MS));
}

/**
 * How sharp a skill is now, 0..1. null when there's nothing to fade: the skill is locked,
 * or was never practised (or was practised before this was recorded). A practice time in
 * the future (another device's clock) counts as just now.
 */
export function skillSharpness(p: SharpnessInput | undefined, now: Date | string | number): number | null {
  if (!p || p.status === "locked" || !p.lastPracticedAt) return null;
  const at = Date.parse(p.lastPracticedAt);
  if (Number.isNaN(at)) return null;
  const days = Math.max(0, (ms(now) - at) / DAY_MS);
  return 0.5 ** (days / halfLifeDays(p.level));
}

export function isFaded(p: SharpnessInput | undefined, now: Date | string | number): boolean {
  const s = skillSharpness(p, now);
  return s !== null && s < FADED_BELOW;
}

export interface FadedSkill {
  skill: SkillId;
  sharpness: number;
  /** Whole days since the last practice. */
  days: number;
}

/** Faded skills, least sharp first (ties go to the earlier skill in the curriculum). */
export function fadedSkills(skills: Partial<Record<SkillId, SharpnessInput>>, now: Date | string | number): FadedSkill[] {
  const out: FadedSkill[] = [];
  for (const { id } of SKILLS) {
    const s = skillSharpness(skills[id], now);
    if (s !== null && s < FADED_BELOW) out.push({ skill: id, sharpness: s, days: daysSincePracticed(skills[id], now)! });
  }
  // stable sort keeps curriculum order on a tie
  return out.sort((a, b) => a.sharpness - b.sharpness);
}

/** The later of two practice times (either may be missing or malformed). */
export function laterPracticedAt(a: string | null | undefined, b: string | null | undefined): string | undefined {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (Number.isNaN(ta)) return Number.isNaN(tb) ? undefined : b!;
  if (Number.isNaN(tb)) return a!;
  return tb > ta ? b! : a!;
}
