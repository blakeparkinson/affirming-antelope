// Day keys are local calendar days: pin a zone with DST so the boundaries are real.
process.env.TZ = "America/Los_Angeles";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  dayKey,
  freezesAfterGoalHit,
  freezesHeld,
  liveStreakDays,
  MAX_FREEZES,
  mergeFreezes,
  mergeStreaks,
  mergeWeeks,
  streakAfterPractice,
  weekAfterPractice,
  weekAsOf,
  weekdayOf,
  weekStartOf,
  noFreezeHistory,
  settleFreezes,
  type PracticeWeek,
  type Streak,
  type StreakFreezes,
} from "../src/habit";

// 2026-10-14 is a Wednesday; its week starts Monday 2026-10-12.
const WED = "2026-10-14";
const MON = "2026-10-12";

// The rules before freezes: the starting freeze was spent long ago, so none is held.
const NONE: StreakFreezes = { earnedDays: [], usedDays: ["2026-01-01"] };
const after = (s: Streak, day: string) => streakAfterPractice(s, day, NONE).streak;
const live = (s: Streak, day: string) => liveStreakDays(s, day, NONE);

const week = (over: Partial<PracticeWeek> = {}): PracticeWeek => ({
  weekStart: MON,
  weekDays: [true, true, false, false, false, false, false],
  weeklyGoal: { target: 3, done: 2, hitCount: 4 },
  ...over,
});

describe("calendar days", () => {
  it("adds days across month, year and DST changes", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-11-01", 1), "2026-11-02"); // US DST ends 2026-11-01
    assert.equal(addDays("2026-03-08", -1), "2026-03-07"); // US DST starts 2026-03-08
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("starts weeks on Monday", () => {
    assert.equal(weekdayOf(MON), 0);
    assert.equal(weekdayOf("2026-10-18"), 6); // Sunday
    assert.equal(weekStartOf("2026-10-18"), MON);
    assert.equal(weekStartOf(MON), MON);
    assert.equal(weekStartOf("2027-01-01"), "2026-12-28");
  });

  it("uses the local day, not UTC, near midnight", () => {
    // 23:30 Tuesday in Los Angeles is already Wednesday in UTC
    assert.equal(dayKey(new Date("2026-10-14T06:30:00Z")), "2026-10-13");
    assert.equal(dayKey(new Date("2026-10-14T07:30:00Z")), WED);
  });
});

describe("streak", () => {
  it("does not double count a second practice the same day", () => {
    const once = after({ days: 4, lastPracticeDay: addDays(WED, -1) }, WED);
    assert.deepEqual(once, { days: 5, lastPracticeDay: WED });
    assert.deepEqual(after(once, WED), once);
  });

  it("extends from yesterday", () => {
    assert.deepEqual(after({ days: 9, lastPracticeDay: "2026-10-13" }, WED), { days: 10, lastPracticeDay: WED });
  });

  it("restarts at 1 after a gap of 2+ days", () => {
    assert.deepEqual(after({ days: 9, lastPracticeDay: "2026-10-12" }, WED), { days: 1, lastPracticeDay: WED });
    assert.deepEqual(after({ days: 30, lastPracticeDay: "2026-09-14" }, WED), { days: 1, lastPracticeDay: WED });
  });

  it("starts at 1 with no history", () => {
    assert.deepEqual(after({ days: 0, lastPracticeDay: null }, WED), { days: 1, lastPracticeDay: WED });
  });

  it("counts practice either side of local midnight as consecutive days", () => {
    const late = after({ days: 2, lastPracticeDay: "2026-10-12" }, dayKey(new Date("2026-10-14T06:59:00Z")));
    assert.deepEqual(late, { days: 3, lastPracticeDay: "2026-10-13" });
    const early = after(late, dayKey(new Date("2026-10-14T07:01:00Z")));
    assert.deepEqual(early, { days: 4, lastPracticeDay: WED });
  });

  it("extends across the DST change", () => {
    assert.deepEqual(after({ days: 3, lastPracticeDay: "2026-11-01" }, "2026-11-02"), { days: 4, lastPracticeDay: "2026-11-02" });
  });

  it("shows 0 once a whole day is missed, before the next practice", () => {
    const s = { days: 6, lastPracticeDay: "2026-10-12" };
    assert.equal(live(s, "2026-10-12"), 6);
    assert.equal(live(s, "2026-10-13"), 6); // today still open
    assert.equal(live(s, WED), 0);
    assert.equal(live({ days: 0, lastPracticeDay: null }, WED), 0);
  });
});

describe("weekly goal", () => {
  it("keeps this week as is", () => {
    const w = week();
    assert.equal(weekAsOf(w, WED), w);
  });

  it("rolls into an empty week on a new Monday, keeping target and weeks hit", () => {
    const rolled = weekAsOf(week(), "2026-10-19");
    assert.deepEqual(rolled, { weekStart: "2026-10-19", weekDays: Array(7).fill(false), weeklyGoal: { target: 3, done: 0, hitCount: 4 } });
  });

  it("rolls past weeks with no practice at all", () => {
    const rolled = weekAsOf(week({ weekStart: "2026-09-07" }), WED);
    assert.equal(rolled.weekStart, MON);
    assert.equal(rolled.weeklyGoal.done, 0);
    assert.ok(rolled.weekDays.every((d) => !d));
  });

  it("treats a document with no week yet as empty", () => {
    const rolled = weekAsOf(week({ weekStart: null }), WED);
    assert.equal(rolled.weekStart, MON);
    assert.equal(rolled.weeklyGoal.done, 0);
  });

  it("counts practice into this week and flags the hit once", () => {
    const hit = weekAfterPractice(week(), WED);
    assert.deepEqual(hit.weekDays, [true, true, true, false, false, false, false]);
    assert.deepEqual(hit.weeklyGoal, { target: 3, done: 3, hitCount: 5 });
    assert.equal(hit.justHit, true);
    const again = weekAfterPractice(hit, WED);
    assert.equal(again.weeklyGoal.done, 4);
    assert.equal(again.weeklyGoal.hitCount, 5);
    assert.equal(again.justHit, false);
  });

  it("counts the first practice of a new week from zero", () => {
    const next = weekAfterPractice(week({ weeklyGoal: { target: 3, done: 3, hitCount: 4 } }), "2026-10-20");
    assert.equal(next.weekStart, "2026-10-19");
    assert.deepEqual(next.weekDays, [false, true, false, false, false, false, false]);
    assert.deepEqual(next.weeklyGoal, { target: 3, done: 1, hitCount: 4 });
  });

  it("files Sunday-night practice under the week it belongs to", () => {
    const sunday = dayKey(new Date("2026-10-19T06:30:00Z")); // 23:30 Sunday local
    assert.equal(sunday, "2026-10-18");
    const w = weekAfterPractice(week(), sunday);
    assert.equal(w.weekStart, MON);
    assert.equal(w.weekDays[6], true);
  });
});

describe("merging two devices", () => {
  it("keeps the later run when the earlier one broke off", () => {
    const stale = { days: 20, lastPracticeDay: "2026-10-01" };
    const fresh = { days: 2, lastPracticeDay: WED };
    assert.deepEqual(mergeStreaks(stale, fresh), fresh);
    assert.deepEqual(mergeStreaks(fresh, stale), fresh);
  });

  it("joins runs that touch (a device restarted without seeing yesterday's practice)", () => {
    const a = { days: 5, lastPracticeDay: "2026-10-13" }; // Oct 9-13
    const b = { days: 1, lastPracticeDay: WED }; // restarted at 1 on Oct 14
    assert.deepEqual(mergeStreaks(a, b), { days: 6, lastPracticeDay: WED });
    assert.deepEqual(mergeStreaks(b, a), { days: 6, lastPracticeDay: WED });
  });

  it("joins overlapping runs on the same last day", () => {
    assert.deepEqual(mergeStreaks({ days: 5, lastPracticeDay: WED }, { days: 1, lastPracticeDay: WED }), { days: 5, lastPracticeDay: WED });
  });

  it("does not join runs a day apart", () => {
    const a = { days: 5, lastPracticeDay: "2026-10-12" };
    const b = { days: 1, lastPracticeDay: WED };
    assert.deepEqual(mergeStreaks(a, b), b);
  });

  it("ignores an empty streak", () => {
    const a = { days: 3, lastPracticeDay: WED };
    assert.deepEqual(mergeStreaks(a, { days: 0, lastPracticeDay: null }), a);
    assert.deepEqual(mergeStreaks({ days: 0, lastPracticeDay: null }, a), a);
  });

  it("takes the later week whole, so last week's count never carries over", () => {
    const last = week({ weekStart: "2026-10-05", weekDays: Array(7).fill(true), weeklyGoal: { target: 3, done: 7, hitCount: 9 } });
    const now = week({ weekDays: [true, false, false, false, false, false, false], weeklyGoal: { target: 3, done: 1, hitCount: 8 } });
    for (const [x, y] of [[last, now], [now, last]]) {
      const m = mergeWeeks(x, y);
      assert.equal(m.weekStart, MON);
      assert.deepEqual(m.weekDays, now.weekDays);
      assert.equal(m.weeklyGoal.done, 1);
      assert.equal(m.weeklyGoal.hitCount, 9);
    }
  });

  it("combines the same week", () => {
    const a = week({ weekDays: [true, false, false, false, false, false, false], weeklyGoal: { target: 3, done: 1, hitCount: 0 } });
    const b = week({ weekDays: [false, false, true, false, false, false, false], weeklyGoal: { target: 5, done: 2, hitCount: 1 } });
    const m = mergeWeeks(a, b);
    assert.deepEqual(m.weekDays, [true, false, true, false, false, false, false]);
    assert.deepEqual(m.weeklyGoal, { target: 3, done: 2, hitCount: 1 });
  });
});

describe("streak freezes", () => {
  const ONE = noFreezeHistory(); // the starting freeze
  const TWO: StreakFreezes = { earnedDays: ["2026-10-04"], usedDays: [] };
  const MONDAY_ON_12: Streak = { days: 12, lastPracticeDay: MON };

  it("starts with one and holds at most two", () => {
    assert.equal(freezesHeld(ONE), 1);
    assert.equal(freezesHeld(TWO), 2);
    assert.equal(freezesHeld(NONE), 0);
  });

  it("covers a missed day with a freeze and keeps the streak", () => {
    // practised Monday, missed Tuesday, open Wednesday
    assert.equal(liveStreakDays(MONDAY_ON_12, WED, ONE), 12);
    const s = settleFreezes(MONDAY_ON_12, ONE, WED);
    assert.deepEqual(s, { alive: true, freezes: { earnedDays: [], usedDays: ["2026-10-13"] }, used: ["2026-10-13"] });
    assert.equal(freezesHeld(s.freezes), 0);
    // practising Wednesday extends it; the frozen day doesn't add to the count
    const p = streakAfterPractice(MONDAY_ON_12, WED, ONE);
    assert.deepEqual(p.streak, { days: 13, lastPracticeDay: WED });
    assert.deepEqual(p.freezes.usedDays, ["2026-10-13"]);
    assert.deepEqual(p.used, ["2026-10-13"]);
  });

  it("breaks the streak on a missed day with no freeze", () => {
    assert.equal(liveStreakDays(MONDAY_ON_12, WED, NONE), 0);
    const p = streakAfterPractice(MONDAY_ON_12, WED, NONE);
    assert.deepEqual(p.streak, { days: 1, lastPracticeDay: WED });
    assert.deepEqual(p.used, []);
  });

  it("needs two freezes for two missed days in a row", () => {
    const thu = "2026-10-15"; // missed Tuesday and Wednesday
    assert.equal(liveStreakDays(MONDAY_ON_12, thu, TWO), 12);
    assert.deepEqual(settleFreezes(MONDAY_ON_12, TWO, thu).used, ["2026-10-13", WED]);
    // one freeze covers Tuesday and is spent; Wednesday breaks the streak
    assert.equal(liveStreakDays(MONDAY_ON_12, thu, ONE), 0);
    const s = settleFreezes(MONDAY_ON_12, ONE, thu);
    assert.equal(s.alive, false);
    assert.deepEqual(s.used, ["2026-10-13"]);
    assert.deepEqual(streakAfterPractice(MONDAY_ON_12, thu, ONE).streak, { days: 1, lastPracticeDay: thu });
  });

  it("gives the same answer whether or not the app was opened during the gap", () => {
    const thu = "2026-10-15";
    const openedWed = settleFreezes(MONDAY_ON_12, ONE, WED).freezes;
    assert.deepEqual(settleFreezes(MONDAY_ON_12, openedWed, thu).freezes, settleFreezes(MONDAY_ON_12, ONE, thu).freezes);
    // a day already frozen isn't paid for again
    assert.deepEqual(settleFreezes(MONDAY_ON_12, openedWed, WED).used, []);
    assert.equal(liveStreakDays(MONDAY_ON_12, WED, openedWed), 12);
  });

  it("uses nothing while the streak is unbroken", () => {
    assert.deepEqual(settleFreezes({ days: 3, lastPracticeDay: "2026-10-13" }, ONE, WED).used, []);
    assert.deepEqual(settleFreezes({ days: 3, lastPracticeDay: WED }, ONE, WED).used, []);
    assert.deepEqual(settleFreezes({ days: 0, lastPracticeDay: null }, ONE, WED), { alive: false, freezes: ONE, used: [] });
  });

  it("records the same practice twice once, and pays for the gap once", () => {
    const once = streakAfterPractice(MONDAY_ON_12, WED, ONE);
    const twice = streakAfterPractice(once.streak, WED, once.freezes);
    assert.deepEqual(twice.streak, once.streak);
    assert.deepEqual(twice.freezes, once.freezes);
    assert.deepEqual(twice.used, []);
  });

  it("earns one per weekly goal hit, once a week, and wastes it at the cap", () => {
    const earned = freezesAfterGoalHit(ONE, MON);
    assert.equal(freezesHeld(earned), 2);
    // the goal hit again the same week (or the same practice recorded twice) earns nothing
    assert.equal(freezesAfterGoalHit(earned, WED), earned);
    // at the cap, next week's hit is wasted: still 2, and spending one leaves 1
    const atCap = freezesAfterGoalHit(earned, "2026-10-19");
    assert.equal(freezesHeld(atCap), MAX_FREEZES);
    assert.equal(freezesHeld({ ...atCap, usedDays: ["2026-10-21"] }), 1);
    // spent before the hit, the earn refills it
    assert.equal(freezesHeld({ earnedDays: ["2026-10-19"], usedDays: ["2026-10-13"] }), 1);
    assert.equal(freezesHeld({ earnedDays: ["2026-10-12", "2026-10-19"], usedDays: ["2026-10-20"] }), 1);
  });
});

describe("merging freezes", () => {
  const MON_ON_12: Streak = { days: 12, lastPracticeDay: MON };

  it("never spends the same freeze twice: two devices freezing the same day pay once", () => {
    const a = settleFreezes(MON_ON_12, noFreezeHistory(), WED).freezes;
    const b = settleFreezes(MON_ON_12, { earnedDays: ["2026-10-05"], usedDays: [] }, WED).freezes;
    const m = mergeFreezes(a, b);
    assert.deepEqual(m.usedDays, ["2026-10-13"]);
    assert.equal(freezesHeld(m), 1);
    assert.deepEqual(mergeFreezes(b, a), m);
  });

  it("never hands a spent freeze back when a stale copy merges with a fresh one", () => {
    const stale = noFreezeHistory(); // last synced before the gap: holds 1
    const fresh = settleFreezes(MON_ON_12, stale, WED).freezes; // used it on Tuesday: holds 0
    for (const m of [mergeFreezes(stale, fresh), mergeFreezes(fresh, stale)]) {
      assert.equal(freezesHeld(m), 0);
      assert.deepEqual(m.usedDays, ["2026-10-13"]);
    }
  });

  it("counts a week's goal hit once when both devices hit it", () => {
    const m = mergeFreezes(freezesAfterGoalHit(noFreezeHistory(), MON), freezesAfterGoalHit(noFreezeHistory(), WED));
    assert.deepEqual(m.earnedDays, [MON]);
    assert.equal(freezesHeld(m), 2);
  });

  it("joins runs across a frozen day, without counting it", () => {
    // device A: practised through Monday. Device B froze Tuesday, then practised Wednesday
    // without A's history (restarted at 1 had it not been frozen).
    const a: Streak = { days: 12, lastPracticeDay: MON };
    const b: Streak = { days: 1, lastPracticeDay: WED };
    assert.deepEqual(mergeStreaks(a, b, ["2026-10-13"]), { days: 13, lastPracticeDay: WED });
    assert.deepEqual(mergeStreaks(b, a, ["2026-10-13"]), { days: 13, lastPracticeDay: WED });
    // the same run on both sides stays the same length
    const run: Streak = { days: 13, lastPracticeDay: WED };
    assert.deepEqual(mergeStreaks(run, run, ["2026-10-13"]), run);
    assert.deepEqual(mergeStreaks(run, a, ["2026-10-13"]), run);
    // without the frozen day the gap breaks it and the later run wins
    assert.deepEqual(mergeStreaks(a, b), b);
  });
});
