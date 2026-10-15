/**
 * Where the streak, freezes, milestones, the weekly goal, reminders and sync meet. Each
 * feature has its own tests; these check that they agree on what "today", "yesterday"
 * and "this week" mean when the calendar does something awkward.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  dayAt,
  freezesHeld,
  practiceDay,
  streakAfterPractice,
  weekAfterPractice,
  weekAsOf,
  type PracticeWeek,
  type Streak,
  type StreakFreezes,
} from "../src/habit";
import { freshSyncedDoc, mergeSynced, type SyncedDoc } from "../src/learnerDoc";
import { markMilestone, milestoneToCelebrate } from "../src/milestones";
import { planReminders } from "../src/reminders";

// 2026-10-12 is a Monday.
const SUN = "2026-10-11";
const MON = "2026-10-12";
const TUE = "2026-10-13";
const WED = "2026-10-14";
const ONE_HELD: StreakFreezes = { earnedDays: [], usedDays: [] };

const week = (over: Partial<PracticeWeek> = {}): PracticeWeek => ({
  weekStart: MON,
  weekDays: [true, false, false, false, false, false, false],
  weeklyGoal: { target: 3, done: 1, hitCount: 0 },
  ...over,
});

describe("the clock reads earlier than the last practice (a flight west, a clock set back)", () => {
  it("a practice counts for the last practice day, not a day before it", () => {
    assert.equal(practiceDay(MON, TUE), TUE);
    assert.equal(practiceDay(WED, TUE), WED);
    assert.equal(practiceDay(MON, null), MON);
  });

  it("a last practice from a clock that was days ahead doesn't hold later practice to its day", () => {
    const wrong = addDays(MON, 30);
    assert.equal(practiceDay(MON, wrong), MON);
    assert.equal(practiceDay(MON, addDays(MON, 2)), addDays(MON, 2));
    assert.deepEqual(streakAfterPractice({ days: 1, lastPracticeDay: wrong }, MON, ONE_HELD).streak.lastPracticeDay, MON);
  });

  it("practising again doesn't add a day, and the run doesn't move backwards", () => {
    const s: Streak = { days: 3, lastPracticeDay: TUE };
    const r = streakAfterPractice(s, MON, ONE_HELD);
    assert.deepEqual(r.streak, s);
    // so the real Wednesday is day 4, not day 5
    assert.equal(streakAfterPractice(r.streak, WED, r.freezes).streak.days, 4);
  });

  it("the week on Sunday-by-the-clock keeps Monday's week instead of wiping it", () => {
    const w = week();
    assert.equal(weekAsOf(w, SUN), w);
    const after = weekAfterPractice(w, practiceDay(SUN, MON));
    assert.equal(after.weekStart, MON);
    assert.equal(after.weeklyGoal.done, 2);
    // a stored week from a clock that was weeks ahead gives way to this week
    assert.equal(weekAsOf(week({ weekStart: addDays(MON, 28) }), MON).weekStart, MON);
  });
});

describe("Monday rollover", () => {
  it("Sunday's practice is last week; the first practice Monday starts a fresh week", () => {
    const sunday = week({ weekStart: addDays(MON, -7), weekDays: [true, true, true, false, false, false, true], weeklyGoal: { target: 3, done: 4, hitCount: 1 } });
    const w = weekAfterPractice(sunday, MON);
    assert.equal(w.weekStart, MON);
    assert.deepEqual(w.weekDays, [true, false, false, false, false, false, false]);
    assert.equal(w.weeklyGoal.done, 1);
    assert.equal(w.weeklyGoal.hitCount, 1);
  });
});

describe("a freeze, then a milestone", () => {
  it("the frozen day bridges the run but doesn't count, so 3 plays once, on the third practice", () => {
    // practised Sat and Sun, missed Mon (a freeze covers it), practise Tue: day 3
    const s: Streak = { days: 2, lastPracticeDay: SUN };
    const tue = streakAfterPractice(s, TUE, ONE_HELD);
    assert.deepEqual(tue.used, [MON]);
    assert.equal(tue.streak.days, 3);
    assert.equal(freezesHeld(tue.freezes), 0);
    const m = milestoneToCelebrate(2, tue.streak, [], tue.freezes.usedDays);
    assert.equal(m, 3);
    const seen = markMilestone([], 3, TUE);
    // a second practice the same day: no replay
    const again = streakAfterPractice(tue.streak, TUE, tue.freezes);
    assert.equal(milestoneToCelebrate(3, again.streak, seen, again.freezes.usedDays), null);
    // the next day is 4: nothing to play, and 3 isn't counted again
    const wed = streakAfterPractice(tue.streak, WED, tue.freezes);
    assert.equal(wed.streak.days, 4);
    assert.equal(milestoneToCelebrate(3, wed.streak, seen, wed.freezes.usedDays), null);
  });
});

describe("reminders after a freeze and after the daily rep", () => {
  const prefs = { on: true, hour: 19, minute: 0 };

  it("a practice today clears today's reminder and moves the nudge to tomorrow", () => {
    const now = dayAt(TUE, 9);
    const before = planReminders({ prefs, streak: { days: 5, lastPracticeDay: MON }, freezes: { earnedDays: [], usedDays: ["2026-01-01"] }, now });
    assert.equal(before[0].day, TUE);
    assert.equal(before[0].kind, "streak");
    const after = planReminders({ prefs, streak: { days: 6, lastPracticeDay: TUE }, freezes: { earnedDays: [], usedDays: ["2026-01-01"] }, now });
    assert.ok(after.every((r) => r.day > TUE));
  });

  it("once the freeze is spent, the next missed day is the one the streak ends on", () => {
    const now = dayAt(TUE, 9);
    const streak: Streak = { days: 5, lastPracticeDay: SUN };
    // the freeze is still held: Monday is covered by it, Tuesday is the last day
    const held = planReminders({ prefs, streak, freezes: ONE_HELD, now });
    // Home opened and spent it on Monday: the same plan
    const spent = planReminders({ prefs, streak, freezes: { earnedDays: [], usedDays: [MON] }, now });
    assert.deepEqual(
      spent.map((r) => r.id),
      held.map((r) => r.id),
    );
    assert.equal(spent.find((r) => r.kind === "streak")?.day, TUE);
  });

  it("a practice dated after today (the clock moved back) gets no reminder today", () => {
    const plan = planReminders({ prefs, streak: { days: 3, lastPracticeDay: TUE }, freezes: ONE_HELD, now: dayAt(MON, 9) });
    assert.ok(plan.every((r) => r.day > MON));
  });
});

describe("two devices, the new fields", () => {
  const doc = (over: Partial<SyncedDoc>): SyncedDoc => ({ ...freshSyncedDoc("mi-for-leaders", "2026-10-01T00:00:00.000Z"), ...over });

  it("freezes, milestones and the week all merge, in either order", () => {
    const phone = doc({
      streak: { days: 3, lastPracticeDay: TUE },
      freezes: { earnedDays: [], usedDays: [MON] },
      milestones: [{ days: 3, day: TUE }],
      weekStart: MON,
      weekDays: [false, true, false, false, false, false, false],
      weeklyGoal: { target: 3, done: 1, hitCount: 0 },
    });
    const tablet = doc({
      streak: { days: 2, lastPracticeDay: SUN },
      freezes: { earnedDays: [SUN], usedDays: [] },
      milestones: [{ days: 7, day: "2026-09-20" }],
      weekStart: addDays(MON, -7),
      weekDays: [true, true, true, false, false, false, true],
      weeklyGoal: { target: 3, done: 4, hitCount: 1 },
    });
    for (const [a, b] of [
      [phone, tablet],
      [tablet, phone],
    ]) {
      const m = mergeSynced(a, b);
      assert.deepEqual(m.freezes, { earnedDays: [SUN], usedDays: [MON] });
      assert.deepEqual(m.milestones, [
        { days: 7, day: "2026-09-20" },
        { days: 3, day: TUE },
      ]);
      assert.equal(m.weekStart, MON);
      assert.deepEqual(m.weekDays, [false, true, false, false, false, false, false]);
      assert.equal(m.weeklyGoal.done, 1);
      assert.equal(m.weeklyGoal.hitCount, 1);
      assert.deepEqual(m.streak, { days: 3, lastPracticeDay: TUE });
    }
  });

  it("a freeze one device spent on a day the other practised is handed back", () => {
    const phone = doc({ streak: { days: 2, lastPracticeDay: MON }, weekStart: MON, weekDays: [true, false, false, false, false, false, false] });
    // the tablet hadn't seen Monday's practice: it froze Monday and practised Tuesday
    const tablet = doc({ streak: { days: 2, lastPracticeDay: TUE }, freezes: { earnedDays: [], usedDays: [MON] } });
    const m = mergeSynced(tablet, phone);
    assert.deepEqual(m.freezes.usedDays, []);
    assert.equal(freezesHeld(m.freezes), 1);
  });
});
