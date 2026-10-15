import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickDailyRep, type DailyRepInput } from "../src/dailyRep";
import { DRILLS, getDrill } from "../src/drills";
import { addDays } from "../src/habit";
import type { SkillId } from "../src/types";

const DAY = "2026-10-15";
type Skills = DailyRepInput["skills"];
const on = (level: 1 | 2 | 3 | 4 | 5 | 6, percent: number) => ({ level, percent, status: "in-progress" as const });
const locked = { level: 1 as const, percent: 0, status: "locked" as const };
const input = (over: Partial<DailyRepInput> = {}): DailyRepInput => ({
  skills: { oars: on(1, 40), engaging: on(1, 10) },
  completedToday: [],
  recentDrillIds: [],
  pathway: "mi-for-leaders",
  day: DAY,
  ...over,
});
const idsFor = (skill: SkillId, setting: "workplace" | "clinical" = "workplace") =>
  DRILLS.filter((d) => d.skill === skill && d.setting === setting).map((d) => d.id);

describe("pickDailyRep", () => {
  it("picks from the weakest unlocked skill, at its level", () => {
    const rep = pickDailyRep(input())!;
    assert.equal(rep.skill, "engaging");
    assert.equal(rep.level, 1);
    assert.equal(getDrill(rep.drillId)?.setting, "workplace");
  });

  it("orders by level before percent, and never picks a locked skill", () => {
    const skills: Skills = { oars: on(2, 0), engaging: on(1, 90), evoking: locked };
    assert.equal(pickDailyRep(input({ skills }))!.skill, "engaging");
  });

  it("no skills started: the track's first daily drill", () => {
    assert.equal(pickDailyRep(input({ skills: {} }))!.drillId, "drill-oars-01");
    const allLocked: Skills = { oars: locked, engaging: locked };
    assert.equal(pickDailyRep(input({ skills: allLocked }))!.drillId, "drill-oars-01");
    // ...skipping one done recently
    assert.equal(pickDailyRep(input({ skills: {}, recentDrillIds: ["drill-oars-01"] }))!.drillId, "drill-oars-02");
  });

  it("avoids recent drills, dropping a level before repeating one", () => {
    const skills: Skills = { engaging: on(2, 0) };
    assert.equal(pickDailyRep(input({ skills }))!.drillId, "drill-engaging-02");
    const rep = pickDailyRep(input({ skills, recentDrillIds: ["drill-engaging-02"] }))!;
    assert.equal(rep.skill, "engaging");
    assert.equal(rep.level, 1);
  });

  it("moves to the next weakest skill when the weakest has only recent drills", () => {
    const skills: Skills = { engaging: on(1, 0), oars: on(1, 50) };
    const rep = pickDailyRep(input({ skills, recentDrillIds: idsFor("engaging") }))!;
    assert.equal(rep.skill, "oars");
  });

  it("every drill recent: the weakest skill's drill done longest ago", () => {
    const skills: Skills = { engaging: on(1, 0), oars: on(1, 50) };
    const all = DRILLS.filter((d) => d.setting === "workplace").map((d) => d.id);
    // newest first: drill-engaging-01 sits last, so it was done longest ago
    const recent = [...all.filter((id) => id !== "drill-engaging-01"), "drill-engaging-01"];
    assert.equal(pickDailyRep(input({ skills, recentDrillIds: recent }))!.drillId, "drill-engaging-01");
  });

  it("breaks a tie between skills by curriculum order", () => {
    const a = pickDailyRep(input({ skills: { engaging: on(1, 20), oars: on(1, 20) } }))!;
    const b = pickDailyRep(input({ skills: { oars: on(1, 20), engaging: on(1, 20) } }))!;
    assert.equal(a.skill, "oars");
    assert.deepEqual(a, b);
  });

  it("is the same drill for the same day, and the day can change it", () => {
    const skills: Skills = { oars: on(1, 0) };
    assert.deepEqual(pickDailyRep(input({ skills })), pickDailyRep(input({ skills })));
    const week = Array.from({ length: 7 }, (_, i) => pickDailyRep(input({ skills, day: addDays(DAY, i) }))!.drillId);
    assert.ok(new Set(week).size > 1, `one drill all week: ${week[0]}`);
    for (const id of week) assert.equal(getDrill(id)?.level, 1);
  });

  it("one more: never a drill already done today", () => {
    const skills: Skills = { oars: on(1, 0) };
    const first = pickDailyRep(input({ skills }))!;
    const next = pickDailyRep(input({ skills, completedToday: [first.drillId] }))!;
    assert.notEqual(next.drillId, first.drillId);
    assert.equal(next.skill, "oars");
  });

  it("follows a pathway switch to that track's drills", () => {
    const skills: Skills = { oars: on(1, 0), leadership: on(1, 0) };
    const rep = pickDailyRep(input({ skills, pathway: "mi-for-clinicians" }))!;
    assert.equal(getDrill(rep.drillId)?.setting, "clinical");
    assert.equal(rep.skill, "oars");
    // leadership has no clinical drills, so it's never the clinicians' rep
    const onlyLeadership = pickDailyRep(input({ skills: { leadership: on(1, 0) }, pathway: "mi-for-clinicians" }))!;
    assert.equal(onlyLeadership.drillId, "drill-cl-oars-01");
    assert.ok(idsFor("oars", "clinical").includes(rep.drillId));
  });
});
