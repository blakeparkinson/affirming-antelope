// The server merge runs in UTC; nothing in it may depend on the clock or the zone.
process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshSyncedDoc, mergeGuestIntoAccount, mergeSynced, normalizeSynced, upgradeDoc, type SyncedDoc } from "../src/learnerDoc";

const doc = (over: Partial<SyncedDoc>): SyncedDoc => ({ ...freshSyncedDoc("mi-for-leaders", "2026-09-01T00:00:00.000Z"), ...over });

// Device A last practised two weeks ago on a long streak; device B broke it and practised this week.
const stale = doc({
  streak: { days: 12, lastPracticeDay: "2026-09-30" },
  weekStart: "2026-09-28",
  weekDays: [true, true, true, false, false, false, false],
  weeklyGoal: { target: 3, done: 3, hitCount: 2 },
  scenariosCompleted: 5,
});
const fresh = doc({
  streak: { days: 2, lastPracticeDay: "2026-10-14" },
  weekStart: "2026-10-12",
  weekDays: [false, true, true, false, false, false, false],
  weeklyGoal: { target: 3, done: 2, hitCount: 1 },
  scenariosCompleted: 3,
});

describe("mergeSynced", () => {
  it("never revives a broken streak or last week's count, whichever side is stale", () => {
    for (const [local, remote] of [[stale, fresh], [fresh, stale]]) {
      const m = mergeSynced(local, remote);
      assert.deepEqual(m.streak, fresh.streak);
      assert.equal(m.weekStart, "2026-10-12");
      assert.deepEqual(m.weekDays, fresh.weekDays);
      assert.equal(m.weeklyGoal.done, 2);
      assert.equal(m.weeklyGoal.hitCount, 2); // weeks hit only climbs
      assert.equal(m.scenariosCompleted, 5);
    }
  });

  it("joins the streak when one device practised yesterday and the other restarted today", () => {
    const yesterday = doc({ streak: { days: 7, lastPracticeDay: "2026-10-13" }, weekStart: "2026-10-12", weekDays: [true, true, false, false, false, false, false], weeklyGoal: { target: 3, done: 2, hitCount: 0 } });
    const today = doc({ streak: { days: 1, lastPracticeDay: "2026-10-14" }, weekStart: "2026-10-12", weekDays: [false, false, true, false, false, false, false], weeklyGoal: { target: 3, done: 1, hitCount: 0 } });
    const m = mergeSynced(yesterday, today);
    assert.deepEqual(m.streak, { days: 8, lastPracticeDay: "2026-10-14" });
    assert.deepEqual(m.weekDays, [true, true, true, false, false, false, false]);
    assert.equal(m.weeklyGoal.done, 2);
  });

  it("dates an older app's document by its last practice", () => {
    const { weekStart: _drop, ...rest } = stale;
    const m = mergeSynced(fresh, { ...rest });
    assert.equal(m.weekStart, "2026-10-12");
    assert.equal(m.weeklyGoal.done, 2);
  });
});

describe("upgradeDoc (documents saved before weekStart)", () => {
  it("infers the week from the last practice day", () => {
    const up = upgradeDoc({ streak: { days: 2, lastPracticeDay: "2026-10-10" }, weekDays: [false, true, false, false, false, true, false], weeklyGoal: { target: 3, done: 2, hitCount: 0 } });
    assert.equal(up.weekStart, "2026-10-05");
  });

  it("leaves a never-practised week undated rather than borrowing the fallback's", () => {
    const up = upgradeDoc({ streak: { days: 0, lastPracticeDay: null }, weekDays: Array(7).fill(false), weeklyGoal: { target: 3, done: 0, hitCount: 0 } });
    assert.equal(up.weekStart, null);
    assert.equal(normalizeSynced({ weekDays: Array(7).fill(false), weeklyGoal: { target: 3, done: 0, hitCount: 0 } }, fresh).weekStart, null);
  });

  it("keeps a stored weekStart", () => {
    assert.equal(upgradeDoc({ weekStart: "2026-10-12", weekDays: [] }).weekStart, "2026-10-12");
  });
});

describe("mergeGuestIntoAccount", () => {
  it("applies the same rules to a stale account and a fresh guest", () => {
    const merged = mergeGuestIntoAccount(stale, fresh) as unknown as SyncedDoc;
    assert.deepEqual(merged.streak, fresh.streak);
    assert.equal(merged.weekStart, "2026-10-12");
    assert.equal(merged.weeklyGoal.done, 2);
  });
});
