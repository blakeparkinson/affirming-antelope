import { DRILLS, dailyDrillOrder } from "./drills";
import type { DayKey } from "./habit";
import { getPathway } from "./pathway";
import { SKILLS } from "./skills";
import type { Drill, PathwayId, SkillId, SkillLevelNumber } from "./types";
import type { DemoSkillProgress } from "./demo";

/**
 * The daily rep: one short drill, picked for the learner, that keeps the streak in one
 * tap. It comes from the weakest unlocked skill (lowest level, then lowest percent; ties
 * go to the earlier skill in the curriculum), at the skill's level when there's a drill
 * for it, and skips drills done in the last few days. Among equal candidates the day
 * picks, so the same inputs give the same drill all day.
 *
 * Skill progress moves as the learner practices, so the app pins the first pick of the
 * day and reads that back (Home and a tapped reminder then agree). Pass today's drills
 * in `completedToday` to get "one more": the next pick, never a drill already done today.
 */

/** How many days back a drill counts as recent. */
export const DAILY_REP_RECENT_DAYS = 3;
/** What Home shows on the card. Recognize drills take about a minute, a typed reply about two. */
export const DAILY_REP_MINUTES = 2;

export interface DailyRepInput {
  /** The learner's skills. Locked or missing skills are never picked. */
  skills: Partial<Record<SkillId, Pick<DemoSkillProgress, "level" | "percent" | "status">>>;
  /** Drill ids done today, newest first. */
  completedToday: string[];
  /** Drill ids done in the last few days before today, newest first. */
  recentDrillIds: string[];
  /** The active track: only its setting's drills are picked. */
  pathway: PathwayId;
  day: DayKey;
}

export interface DailyRep {
  drillId: string;
  skill: SkillId;
  level: SkillLevelNumber;
}

/** A small stable hash, so the day (not Math.random) chooses among equals. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The track's drills, in its daily order first, then any others written for its setting. */
function poolFor(pathway: PathwayId): Drill[] {
  const setting = getPathway(pathway).setting;
  const inSetting = DRILLS.filter((d) => d.setting === setting);
  const rank = new Map(dailyDrillOrder(pathway).map((id, i) => [id, i]));
  return [...inSetting].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

/** A skill's drills in tiers: its level, then each level below (nearest first), then above. */
function tiers(drills: Drill[], level: number): Drill[][] {
  const levels = [...new Set(drills.map((d) => d.level))].sort((a, b) => {
    const da = a <= level ? level - a : 100 + a;
    const db = b <= level ? level - b : 100 + b;
    return da - db;
  });
  return levels.map((l) => drills.filter((d) => d.level === l));
}

export function pickDailyRep({ skills, completedToday, recentDrillIds, pathway, day }: DailyRepInput): DailyRep | null {
  const pool = poolFor(pathway);
  if (!pool.length) return null;
  // newest first: today's, then the recent days'
  const recency = new Map<string, number>();
  [...completedToday, ...recentDrillIds].forEach((id, i) => {
    if (!recency.has(id)) recency.set(id, i);
  });
  const fresh = (d: Drill) => !recency.has(d.id);
  const rep = (d: Drill): DailyRep => ({ drillId: d.id, skill: d.skill, level: d.level });
  const choose = (list: Drill[], salt: string) => list[hash(`${day}:${salt}`) % list.length];

  const order = SKILLS.map((s) => s.id);
  const weakestFirst = order
    .filter((id) => {
      const p = skills[id];
      return p && p.status !== "locked" && pool.some((d) => d.skill === id);
    })
    .sort((a, b) => {
      const pa = skills[a]!;
      const pb = skills[b]!;
      return pa.level - pb.level || pa.percent - pb.percent || order.indexOf(a) - order.indexOf(b);
    });

  // nothing started yet: the track's first drill that isn't recent
  if (!weakestFirst.length) {
    const first = pool.find(fresh);
    return rep(first ?? leastRecent(pool, recency));
  }

  for (const id of weakestFirst) {
    const level = skills[id]!.level;
    for (const tier of tiers(pool.filter((d) => d.skill === id), level)) {
      const open = tier.filter(fresh);
      if (open.length) return rep(choose(open, id));
    }
  }

  // every drill for every unlocked skill is recent: the weakest skill's, done longest ago
  const weakest = weakestFirst[0];
  return rep(leastRecent(tiers(pool.filter((d) => d.skill === weakest), skills[weakest]!.level).flat(), recency));
}

/** The drill done longest ago (first in the list on a tie, so the order still decides). */
function leastRecent(list: Drill[], recency: Map<string, number>): Drill {
  return list.reduce((best, d) => ((recency.get(d.id) ?? Infinity) > (recency.get(best.id) ?? Infinity) ? d : best));
}
