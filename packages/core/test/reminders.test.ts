// Reminders are local wall-clock times: pin a zone with DST so the boundaries are real.
process.env.TZ = "America/Los_Angeles";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReminderTime,
  planReminders,
  shouldOfferReminders,
  type ReminderPrefs,
} from "../src/reminders";
import { noFreezeHistory, type StreakFreezes } from "../src/habit";

// No freezes held (the starting one spent long ago): the rules before freezes.
const NONE: StreakFreezes = { earnedDays: [], usedDays: ["2026-01-01"] };

// 2026-10-14 is a Wednesday.
const WED = "2026-10-14";
const TUE = "2026-10-13";
const at = (day: string, h: number, m = 0) => {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m);
};
const prefs = (over: Partial<ReminderPrefs> = {}): ReminderPrefs => ({ on: true, hour: 19, minute: 0, ...over });
const summary = (plan: ReturnType<typeof planReminders>) => plan.map((r) => `${r.kind} ${r.day} ${r.at.getHours()}:${`${r.at.getMinutes()}`.padStart(2, "0")}`);

describe("planReminders", () => {
  it("plans nothing when reminders are off, missing, or the learner never practiced", () => {
    const streak = { days: 3, lastPracticeDay: TUE };
    assert.deepEqual(planReminders({ freezes: NONE, prefs: prefs({ on: false }), streak, now: at(WED, 9) }), []);
    assert.deepEqual(planReminders({ freezes: NONE, prefs: undefined, streak, now: at(WED, 9) }), []);
    assert.deepEqual(planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 0, lastPracticeDay: null }, now: at(WED, 9) }), []);
  });

  it("rejects an out-of-range time instead of scheduling a bad date", () => {
    const streak = { days: 1, lastPracticeDay: TUE };
    assert.deepEqual(planReminders({ freezes: NONE, prefs: prefs({ hour: 24 }), streak, now: at(WED, 9) }), []);
    assert.deepEqual(planReminders({ freezes: NONE, prefs: prefs({ minute: 1.5 }), streak, now: at(WED, 9) }), []);
  });

  it("practiced today: skips today, nudges the streak tomorrow, daily the day after, then one lapse", () => {
    const plan = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 5, lastPracticeDay: WED }, now: at(WED, 10) });
    assert.deepEqual(summary(plan), [
      "streak 2026-10-15 19:00",
      "daily 2026-10-16 19:00",
      "lapse 2026-10-17 19:00",
    ]);
    assert.match(plan[0].title, /5-day streak|Day 6/);
  });

  it("streak at risk tonight: streak nudge at their time plus a last call at 20:30", () => {
    const plan = planReminders({ freezes: NONE, prefs: prefs({ hour: 8 }), streak: { days: 4, lastPracticeDay: TUE }, now: at(WED, 7) });
    assert.deepEqual(summary(plan).slice(0, 2), ["streak 2026-10-14 8:00", "last_call 2026-10-14 20:30"]);
  });

  it("no last call when their own time is late in the evening", () => {
    const plan = planReminders({ freezes: NONE, prefs: prefs({ hour: 21 }), streak: { days: 4, lastPracticeDay: TUE }, now: at(WED, 7) });
    assert.equal(plan.filter((r) => r.kind === "last_call").length, 0);
    assert.equal(plan[0].kind, "streak");
  });

  it("a streak of 1 gets the plain daily reminder, not the streak nudge", () => {
    const plan = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 1, lastPracticeDay: TUE }, now: at(WED, 7) });
    assert.equal(plan[0].kind, "daily");
    assert.ok(plan.every((r) => r.kind !== "streak" && r.kind !== "last_call"));
  });

  it("drops anything already past: after 19:00 today only the 20:30 last call is left today", () => {
    const plan = planReminders({ freezes: NONE, prefs: prefs({ hour: 18 }), streak: { days: 4, lastPracticeDay: TUE }, now: at(WED, 19, 30) });
    assert.deepEqual(summary(plan)[0], "last_call 2026-10-14 20:30");
  });

  it("stops after the lapse: three days quiet gets one 'we miss you', four or more gets nothing", () => {
    const three = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 9, lastPracticeDay: "2026-10-11" }, now: at(WED, 9) });
    assert.deepEqual(summary(three), ["lapse 2026-10-14 19:00"]);
    const four = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 9, lastPracticeDay: "2026-10-10" }, now: at(WED, 9) });
    assert.deepEqual(four, []);
  });

  it("same inputs twice give the same plan (ids, times and copy)", () => {
    const input = { freezes: NONE, prefs: prefs(), streak: { days: 3, lastPracticeDay: TUE }, now: at(WED, 9) };
    assert.deepEqual(planReminders(input), planReminders(input));
    const ids = planReminders(input).map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("a last practice dated after today (clock moved back) counts as today", () => {
    const plan = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 2, lastPracticeDay: "2026-10-20" }, now: at(WED, 9) });
    assert.equal(plan[0].day, "2026-10-15");
  });

  it("keeps wall-clock time across the DST change (Nov 1, 2026 in Los Angeles)", () => {
    const plan = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 1, lastPracticeDay: "2026-10-31" }, now: at("2026-10-31", 20) });
    assert.deepEqual(summary(plan), ["daily 2026-11-01 19:00", "daily 2026-11-02 19:00", "lapse 2026-11-03 19:00"]);
  });

  it("re-planned in another time zone, the reminders follow the new local time", () => {
    const tz = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      const plan = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 1, lastPracticeDay: TUE }, now: new Date(2026, 9, 14, 9) });
      assert.equal(plan[0].at.getHours(), 19);
    } finally {
      process.env.TZ = tz;
    }
  });

  it("a practice around midnight counts for the day it happened on", () => {
    // practiced 23:59 Tuesday, planned at 00:01 Wednesday: Wednesday is day 1 of the gap
    const plan = planReminders({ freezes: NONE, prefs: prefs(), streak: { days: 3, lastPracticeDay: TUE }, now: at(WED, 0, 1) });
    assert.equal(plan[0].day, WED);
    assert.equal(plan[0].kind, "streak");
  });
});

describe("shouldOfferReminders", () => {
  it("offers after the first practice, again after the third, then never", () => {
    assert.equal(shouldOfferReminders({ asks: 0, practices: 0, on: false }), false);
    assert.equal(shouldOfferReminders({ asks: 0, practices: 1, on: false }), true);
    assert.equal(shouldOfferReminders({ asks: 1, practices: 2, on: false }), false);
    assert.equal(shouldOfferReminders({ asks: 1, practices: 3, on: false }), true);
    assert.equal(shouldOfferReminders({ asks: 2, practices: 50, on: false }), false);
  });

  it("never offers when reminders are already on", () => {
    assert.equal(shouldOfferReminders({ asks: 0, practices: 1, on: true }), false);
  });
});

describe("formatReminderTime", () => {
  it("formats on the hour and with minutes", () => {
    assert.equal(formatReminderTime(19, 0), "7 pm");
    assert.equal(formatReminderTime(12, 30), "12:30 pm");
    assert.equal(formatReminderTime(0, 5), "12:05 am");
  });
});

describe("planReminders with streak freezes", () => {
  const streak = { days: 6, lastPracticeDay: TUE };

  it("doesn't say the streak ends tonight when a freeze would cover today", () => {
    // one freeze: missing Wednesday is covered, so Thursday is the day it ends
    const plan = planReminders({ prefs: prefs({ hour: 8 }), streak, freezes: noFreezeHistory(), now: at(WED, 7) });
    assert.deepEqual(summary(plan), ["daily 2026-10-14 8:00", "streak 2026-10-15 8:00", "last_call 2026-10-15 20:30", "lapse 2026-10-16 8:00"]);
    assert.match(plan[1].title, /6-day/);
  });

  it("moves the nudge two days out with two freezes", () => {
    const two: StreakFreezes = { earnedDays: ["2026-10-05"], usedDays: [] };
    const plan = planReminders({ prefs: prefs(), streak, freezes: two, now: at(WED, 9) });
    assert.deepEqual(summary(plan), ["daily 2026-10-14 19:00", "daily 2026-10-15 19:00", "streak 2026-10-16 19:00"]);
  });

  it("counts a day already frozen as covered", () => {
    // practised Monday, Tuesday frozen, nothing left: today (Wednesday) is the day it ends
    const plan = planReminders({
      prefs: prefs(),
      streak: { days: 6, lastPracticeDay: "2026-10-12" },
      freezes: { earnedDays: [], usedDays: ["2026-10-13"] },
      now: at(WED, 9),
    });
    assert.deepEqual(summary(plan), ["streak 2026-10-14 19:00", "lapse 2026-10-15 19:00"]);
  });
});
