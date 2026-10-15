// Weeks are local calendar weeks: pin a zone with DST so the boundaries are real.
// (2026-11-01, a Sunday, is the fall-back day in Los Angeles.)
process.env.TZ = "America/Los_Angeles";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshSyncedDoc, mergeSynced, normalizeSynced, upgradeDoc, type SyncedDoc } from "../src/learnerDoc";
import { buildWeeklyRecap, mergeRecapSeen, recapMotion, recapWeekFor, shouldShowRecap, type RecapPractice, type RecapRoleplay } from "../src/recap";
import { planReminders, type ReminderPrefs } from "../src/reminders";
import { noFreezeHistory } from "../src/habit";
import type { DemoSkillProgress } from "../src/demo";
import type { SkillId, Turn } from "../src/types";

// 2026-10-26 is a Monday; 2026-11-02 the Monday after.
const MON = "2026-10-26";
const NEXT_MON = "2026-11-02";
const iso = (day: string, h: number, m = 0) => {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
};
const rec = (day: string, h: number, over: Partial<RecapPractice> = {}): RecapPractice => ({ kind: "drill", skill: "oars", minutes: 2, at: iso(day, h), ...over });

const skills = (over: Partial<Record<SkillId, DemoSkillProgress>> = {}): Partial<Record<SkillId, DemoSkillProgress>> => ({
  ...freshSyncedDoc().skills,
  ...over,
});

const t = (id: string, speaker: Turn["speaker"], text: string, stance?: Turn["stance"]): Turn => ({ id, speaker, text, ...(stance ? { stance } : {}) });

const roleplay = (id: string, endedAt: string, transcript: Turn[], over: Partial<RecapRoleplay> = {}): RecapRoleplay => ({
  id,
  refId: "SP-001",
  transcript,
  endedAt,
  ...over,
});

describe("buildWeeklyRecap", () => {
  it("an empty week is the fresh-start version: no stats, no role-play, still a skill to work on", () => {
    const r = buildWeeklyRecap([rec("2026-10-20", 9)], skills(), MON);
    assert.equal(r.empty, true);
    assert.equal(r.reps, 0);
    assert.equal(r.daysPracticed, 0);
    assert.equal(r.minutes, 0);
    assert.deepEqual(r.days, [false, false, false, false, false, false, false]);
    assert.equal(r.topSkill, null);
    assert.equal(r.bestRoleplay, null);
    assert.ok(r.nextSkill, "an unlocked skill to suggest even with no practice");
  });

  it("counts days, reps and minutes, and the skill practised most", () => {
    const log = [
      rec(MON, 8),
      rec(MON, 20, { skill: "change-talk", minutes: 5 }),
      rec("2026-10-28", 12, { skill: "change-talk", minutes: 3 }),
      rec("2026-10-30", 7),
      rec("2026-10-30", 18, { kind: "roleplay", skill: "change-talk", minutes: 12 }),
    ];
    const r = buildWeeklyRecap(log, skills(), MON);
    assert.equal(r.empty, false);
    assert.equal(r.reps, 5);
    assert.equal(r.daysPracticed, 3);
    assert.equal(r.minutes, 24);
    assert.deepEqual(r.days, [true, false, true, false, true, false, false]);
    assert.deepEqual(r.topSkill, { skill: "change-talk", reps: 3, minutes: 20 });
  });

  it("splits a week at local midnight on Monday, across the DST change", () => {
    // Sunday 23:59 (fall-back day) belongs to the week of the 26th; Monday 00:01 to the next
    const log = [rec("2026-11-01", 23, { at: iso("2026-11-01", 23, 59) }), rec(NEXT_MON, 0, { at: iso(NEXT_MON, 0, 1) })];
    const last = buildWeeklyRecap(log, skills(), MON);
    const next = buildWeeklyRecap(log, skills(), NEXT_MON);
    assert.equal(last.reps, 1);
    assert.equal(last.days[6], true);
    assert.equal(next.reps, 1);
    assert.equal(next.days[0], true);
    // any day of the week names the same week
    assert.equal(buildWeeklyRecap(log, skills(), "2026-10-29").weekStart, MON);
  });

  it("fills in practice from another device with the synced week, and ignores a different week's", () => {
    const week = { weekStart: MON, weekDays: [true, false, true, false, false, false, true], weeklyGoal: { target: 3, done: 4, hitCount: 1 } };
    // this device practised once on Wednesday; the phone did the rest
    const r = buildWeeklyRecap([rec("2026-10-28", 9)], skills(), MON, { week });
    assert.equal(r.empty, false);
    assert.equal(r.daysPracticed, 3);
    assert.equal(r.reps, 4);
    assert.equal(r.minutes, 2);
    const other = buildWeeklyRecap([], skills(), MON, { week: { ...week, weekStart: NEXT_MON } });
    assert.equal(other.empty, true);
  });

  it("after this week's practice moved the synced week on, reads last week's days from the streak run", () => {
    // the tablet practised Thursday to Sunday (the 1st frozen); Monday's practice there moved the week on.
    // This phone has none of it in its log.
    const streak = { days: 4, lastPracticeDay: NEXT_MON };
    const week = { weekStart: NEXT_MON, weekDays: [true, false, false, false, false, false, false], weeklyGoal: { target: 3, done: 1, hitCount: 0 } };
    const r = buildWeeklyRecap([], skills(), MON, { week, streak, frozenDays: ["2026-11-01"] });
    assert.equal(r.empty, false);
    assert.deepEqual(r.days, [false, false, false, true, true, true, false]);
    assert.equal(r.reps, 3);
    // a broken run says nothing about last week
    const old = buildWeeklyRecap([], skills(), MON, { streak: { days: 2, lastPracticeDay: "2026-10-20" } });
    assert.equal(old.empty, true);
  });

  it("suggests the weakest unlocked skill, never a locked one", () => {
    const locked: DemoSkillProgress = { level: 1, percent: 0, status: "locked" };
    const only = (over: Partial<Record<SkillId, DemoSkillProgress>>) => ({ ...Object.fromEntries(Object.keys(skills()).map((k) => [k, locked])), ...over });
    const r = buildWeeklyRecap(
      [],
      only({ oars: { level: 3, percent: 10, status: "in-progress" }, "change-talk": { level: 1, percent: 40, status: "in-progress" }, evoking: { level: 2, percent: 0, status: "in-progress" } }),
      MON,
    );
    assert.equal(r.nextSkill?.skill, "change-talk");
    const none = buildWeeklyRecap([], only({}), MON);
    assert.equal(none.nextSkill, null);
  });

  it("with no role-play that week, keeps the stats and leaves the role-play out", () => {
    const earlier = roleplay("old", iso("2026-10-21", 18), [t("1", "employee", "Fine.", "sustain"), t("2", "learner", "Sounds hard."), t("3", "employee", "Maybe.", "change")]);
    const r = buildWeeklyRecap([rec(MON, 9)], skills(), MON, { roleplays: [earlier] });
    assert.equal(r.reps, 1);
    assert.equal(r.bestRoleplay, null);
  });

  it("picks the role-play with the most change talk, and quotes the learner's line before it opened up", () => {
    const flat = roleplay("flat", iso("2026-10-27", 18), [t("a1", "employee", "I'm fine.", "sustain"), t("a2", "learner", "Okay."), t("a3", "employee", "Yeah.", "sustain")]);
    const warm = roleplay("warm", iso("2026-10-29", 18), [
      t("b1", "employee", "Why am I here?", "discord"),
      t("b2", "learner", "You didn't choose this meeting."),
      t("b3", "employee", "No.", "sustain"),
      t("b4", "learner", "  It sounds like the deadlines are wearing you down.  "),
      t("b5", "employee", "They are. I'd like to fix that.", "change"),
      t("b6", "learner", "What would help?"),
      t("b7", "employee", "Fewer late calls.", "change"),
    ]);
    const r = buildWeeklyRecap([], skills(), MON, { roleplays: [flat, warm] });
    assert.equal(r.bestRoleplay?.sessionId, "warm");
    assert.equal(r.bestRoleplay?.changeTalk, 2);
    assert.equal(r.bestRoleplay?.warmthRise, 2);
    assert.equal(r.bestRoleplay?.arc.length, 4);
    // the learner's own words, trimmed, never invented
    assert.equal(r.bestRoleplay?.line, "It sounds like the deadlines are wearing you down.");
  });

  it("breaks a change-talk tie on the warmth arc, and reads the reviewer's annotations", () => {
    const a = roleplay("a", iso("2026-10-27", 9), [t("1", "employee", "Hm.", "sustain"), t("2", "learner", "Go on."), t("3", "employee", "Maybe.", "ambivalent")]);
    const b = roleplay("b", iso("2026-10-27", 10), [t("1", "employee", "No."), t("2", "learner", "That's frustrating."), t("3", "employee", "It is.")], {
      start: "discord",
      annotations: [{ turnId: "3", speaker: "employee", talk: "neutral", stance: "change" }],
    });
    const c = roleplay("c", iso("2026-10-27", 11), [t("1", "employee", "Fine.", "ambivalent"), t("2", "learner", "Sure."), t("3", "employee", "Ok.", "ambivalent")]);
    const r = buildWeeklyRecap([], skills(), MON, { roleplays: [a, c, b] });
    assert.equal(r.bestRoleplay?.sessionId, "b");
    assert.equal(r.bestRoleplay?.line, "That's frustrating.");
  });

  it("leaves the line out when nothing turned, or the turn came before the learner spoke", () => {
    const cold = roleplay("cold", iso("2026-10-27", 9), [t("1", "employee", "No.", "sustain"), t("2", "learner", "Hm."), t("3", "employee", "Still no.", "sustain")]);
    assert.equal(buildWeeklyRecap([], skills(), MON, { roleplays: [cold] }).bestRoleplay?.line, undefined);
    const opensWarm = roleplay("open", iso("2026-10-27", 9), [t("1", "employee", "I want to change.", "change"), t("2", "learner", "")]);
    const best = buildWeeklyRecap([], skills(), MON, { roleplays: [opensWarm] }).bestRoleplay;
    assert.equal(best?.sessionId, "open");
    assert.equal(best && "line" in best, false);
  });
});

describe("shouldShowRecap", () => {
  it("shows on the first open of a new week, for a learner with practice before it", () => {
    assert.equal(shouldShowRecap({ seenWeek: "2026-10-26", today: NEXT_MON, practiceDays: ["2026-10-28"] }), true);
    assert.equal(recapWeekFor(NEXT_MON), MON);
    assert.equal(recapWeekFor("2026-11-08"), MON);
  });

  it("doesn't show at 23:59 on Sunday, then does at 00:01 on Monday", () => {
    const seenWeek = MON; // shown last Monday
    assert.equal(shouldShowRecap({ seenWeek, today: "2026-11-01", practiceDays: ["2026-10-28"] }), false);
    assert.equal(shouldShowRecap({ seenWeek, today: NEXT_MON, practiceDays: ["2026-10-28"] }), true);
  });

  it("shows the fresh-start version after an empty week (any earlier practice counts)", () => {
    assert.equal(shouldShowRecap({ seenWeek: null, today: NEXT_MON, practiceDays: [null, "2026-09-02"] }), true);
  });

  it("never shows to a learner with no practice before this week", () => {
    assert.equal(shouldShowRecap({ seenWeek: null, today: NEXT_MON, practiceDays: [] }), false);
    assert.equal(shouldShowRecap({ seenWeek: null, today: NEXT_MON, practiceDays: [NEXT_MON, null] }), false);
  });

  it("stays seen when the clock goes back a week", () => {
    assert.equal(shouldShowRecap({ seenWeek: NEXT_MON, today: "2026-10-30", practiceDays: ["2026-09-02"] }), false);
  });
});

describe("recapSeenWeek on two devices", () => {
  const doc = (over: Partial<SyncedDoc>): SyncedDoc => ({ ...freshSyncedDoc("mi-for-leaders", "2026-09-01T00:00:00.000Z"), ...over });
  const practised = { streak: { days: 3, lastPracticeDay: "2026-10-30" } };

  it("shows once: the phone marks it, the tablet merges and doesn't show it again", () => {
    const today = NEXT_MON;
    const phone = doc({ ...practised, recapSeenWeek: MON });
    const tablet = doc({ ...practised, recapSeenWeek: MON });
    const days = [phone.streak.lastPracticeDay];
    assert.equal(shouldShowRecap({ seenWeek: phone.recapSeenWeek, today, practiceDays: days }), true);
    // the phone shows it and syncs
    const phoneAfter = { ...phone, recapSeenWeek: today };
    const tabletAfter = mergeSynced(tablet, phoneAfter);
    assert.equal(tabletAfter.recapSeenWeek, today);
    assert.equal(shouldShowRecap({ seenWeek: tabletAfter.recapSeenWeek, today, practiceDays: days }), false);
    // and the phone keeps its mark whatever the tablet's stale copy says
    assert.equal(mergeSynced(phoneAfter, tablet).recapSeenWeek, today);
  });

  it("merges by the later week, in either order", () => {
    assert.equal(mergeRecapSeen(MON, NEXT_MON), NEXT_MON);
    assert.equal(mergeRecapSeen(NEXT_MON, MON), NEXT_MON);
    assert.equal(mergeRecapSeen(null, MON), MON);
    assert.equal(mergeRecapSeen("nope", undefined), null);
  });

  it("an older app's document (no field) keeps this device's mark; a malformed one is dropped", () => {
    const local = doc({ recapSeenWeek: MON });
    const older = { ...doc({}) } as Record<string, unknown>;
    delete older.recapSeenWeek;
    assert.equal(normalizeSynced(older, local).recapSeenWeek, MON);
    assert.equal(mergeSynced(local, older).recapSeenWeek, MON);
    assert.equal(upgradeDoc({ ...older, recapSeenWeek: "Monday" }).recapSeenWeek, undefined);
    assert.equal(freshSyncedDoc().recapSeenWeek, null);
  });
});

describe("recapMotion", () => {
  it("counts up and draws the arc with motion on", () => {
    const m = recapMotion(false);
    assert.equal(m.countUp, true);
    assert.equal(m.drawArc, true);
    assert.ok(m.countDelay > 0 && m.arcDelay > m.countDelay);
  });

  it("under reduced motion, nothing rolls or draws and nothing waits", () => {
    assert.deepEqual(recapMotion(true), { countUp: false, countDelay: 0, stagger: 0, drawArc: false, arcDelay: 0 });
  });
});

describe("the Monday recap reminder", () => {
  const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({ on: true, hour: 19, minute: 0, ...over });
  const at = (day: string, h: number, m = 0) => {
    const [y, mo, d] = day.split("-").map(Number);
    return new Date(y, mo - 1, d, h, m);
  };
  const recaps = (plan: ReturnType<typeof planReminders>) => plan.filter((r) => r.kind === "recap");

  it("schedules Monday 9:00 when last week had practice, in place of that day's daily reminder", () => {
    // practised Saturday: Sunday and Monday would get the daily reminder
    const plan = planReminders({ prefs: prefs(), streak: { days: 1, lastPracticeDay: "2026-10-31" }, freezes: noFreezeHistory(), now: at("2026-10-31", 20), recap: {} });
    const [r] = recaps(plan);
    assert.equal(r.day, NEXT_MON);
    assert.equal(r.at.getHours(), 9);
    assert.equal(r.title, "Your week in review is ready");
    assert.equal(r.id, `aa-reminder:recap:${NEXT_MON}`);
    assert.equal(plan.filter((x) => x.day === NEXT_MON).length, 1);
    assert.ok(plan.some((x) => x.kind === "daily" && x.day === "2026-11-01"));
  });

  it("reads the stored week too (the last practice may be a later day)", () => {
    const plan = planReminders({
      prefs: prefs(),
      streak: { days: 1, lastPracticeDay: "2026-10-28" },
      freezes: noFreezeHistory(),
      recap: { week: { weekStart: MON, weekDays: [false, false, true, false, false, false, false] } },
      now: at("2026-10-29", 10),
    });
    assert.equal(recaps(plan).length, 1);
  });

  it("skips it when reminders are off, last week had no practice, or the recap was already seen", () => {
    const streak = { days: 1, lastPracticeDay: "2026-10-31" };
    const now = at("2026-10-31", 20);
    assert.equal(recaps(planReminders({ prefs: prefs({ on: false }), streak, freezes: noFreezeHistory(), now, recap: {} })).length, 0);
    assert.equal(recaps(planReminders({ prefs: prefs(), streak, freezes: noFreezeHistory(), now, recap: { seenWeek: NEXT_MON } })).length, 0);
    // a caller that doesn't ask for it gets none
    assert.equal(recaps(planReminders({ prefs: prefs(), streak, freezes: noFreezeHistory(), now })).length, 0);
    // last practised the week before last: next Monday's recap would be empty
    const quiet = planReminders({ prefs: prefs(), streak: { days: 1, lastPracticeDay: "2026-10-24" }, freezes: noFreezeHistory(), now: at("2026-10-27", 8), recap: {} });
    assert.equal(recaps(quiet).length, 0);
  });

  it("is never in the past: Monday after 9:00 plans next week's instead", () => {
    const plan = planReminders({ prefs: prefs(), streak: { days: 1, lastPracticeDay: "2026-10-31" }, freezes: noFreezeHistory(), now: at(NEXT_MON, 9, 30), recap: {} });
    assert.equal(recaps(plan).length, 0);
  });

  it("keeps a streak nudge on the same Monday", () => {
    // a 5-day streak last practised Sunday ends Monday night (no freezes held)
    const plan = planReminders({
      prefs: prefs(),
      streak: { days: 5, lastPracticeDay: "2026-11-01" },
      freezes: { earnedDays: [], usedDays: ["2026-01-01"] },
      now: at("2026-11-01", 21),
      recap: {},
    });
    const monday = plan.filter((x) => x.day === NEXT_MON).map((x) => x.kind);
    assert.deepEqual(monday, ["recap", "streak"]);
  });
});
