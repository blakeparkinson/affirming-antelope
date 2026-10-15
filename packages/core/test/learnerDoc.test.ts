// The server merge runs in UTC; nothing in it may depend on the clock or the zone.
process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freezesHeld, liveStreakDays } from "../src/habit";
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

describe("streak freezes in the synced document", () => {
  // The learner practised through Monday on a 12-day streak and missed Tuesday. The phone
  // opened Wednesday and spent the starting freeze on Tuesday; the tablet last synced Monday.
  const tablet = doc({ streak: { days: 12, lastPracticeDay: "2026-10-12" } });
  const phone = doc({ streak: { days: 12, lastPracticeDay: "2026-10-12" }, freezes: { earnedDays: [], usedDays: ["2026-10-13"] } });

  it("keeps the spent freeze spent, whichever side is stale", () => {
    for (const [local, remote] of [[tablet, phone], [phone, tablet]]) {
      const m = mergeSynced(local, remote);
      assert.deepEqual(m.freezes, { earnedDays: [], usedDays: ["2026-10-13"] });
      assert.equal(freezesHeld(m.freezes), 0);
      assert.equal(liveStreakDays(m.streak, "2026-10-14", m.freezes), 12);
    }
  });

  it("joins a run the other device bridged with a freeze", () => {
    const later = doc({ streak: { days: 1, lastPracticeDay: "2026-10-14" }, freezes: { earnedDays: [], usedDays: ["2026-10-13"] } });
    assert.deepEqual(mergeSynced(tablet, later).streak, { days: 13, lastPracticeDay: "2026-10-14" });
    assert.deepEqual(mergeSynced(later, tablet).streak, { days: 13, lastPracticeDay: "2026-10-14" });
  });

  it("refunds a freeze spent on a day the other device practised", () => {
    // the phone practised Tuesday; the tablet opened Wednesday before that synced and froze Tuesday
    const phoneTue = doc({ streak: { days: 13, lastPracticeDay: "2026-10-13" }, weekStart: "2026-10-12", weekDays: [true, true, false, false, false, false, false], weeklyGoal: { target: 3, done: 2, hitCount: 0 } });
    for (const [local, remote] of [[phone, phoneTue], [phoneTue, phone]]) {
      const m = mergeSynced(local, remote);
      assert.deepEqual(m.freezes.usedDays, []);
      assert.equal(freezesHeld(m.freezes), 1);
      assert.deepEqual(m.streak, { days: 13, lastPracticeDay: "2026-10-13" });
    }
  });

  it("gives a document from before freezes the starting freeze", () => {
    const { freezes: _drop, ...old } = tablet;
    const n = normalizeSynced(old, freshSyncedDoc());
    assert.deepEqual(n.freezes, { earnedDays: [], usedDays: [] });
    assert.equal(freezesHeld(n.freezes), 1);
    // the guest merge on the server fills it the same way
    const stored = mergeGuestIntoAccount(old, { ...old }) as unknown as SyncedDoc;
    assert.equal(freezesHeld(stored.freezes), 1);
  });

  it("drops malformed ledger entries", () => {
    const up = upgradeDoc({ freezes: { earnedDays: ["2026-10-05", 3, "soon"], usedDays: null } });
    assert.deepEqual(up.freezes, { earnedDays: ["2026-10-05"], usedDays: [] });
  });
});

describe("mergeSynced: lastPracticedAt on two devices", () => {
  const phone = "2026-10-14T08:00:00.000Z";
  const tablet = "2026-10-02T19:30:00.000Z";

  it("keeps the newer practice time whichever side has it, even when the other side wins the level", () => {
    // the tablet is a level ahead but practised the skill longer ago
    const a = doc({});
    a.skills = { ...a.skills, oars: { level: 1, percent: 60, status: "in-progress", lastPracticedAt: phone } };
    const b = doc({});
    b.skills = { ...b.skills, oars: { level: 2, percent: 10, status: "in-progress", lastPracticedAt: tablet } };
    for (const [local, remote] of [[a, b], [b, a]]) {
      const m = mergeSynced(local, remote);
      assert.deepEqual(m.skills.oars, { level: 2, percent: 10, status: "in-progress", lastPracticedAt: phone });
    }
  });

  it("keeps a practice time when only one device has one (an older app's document)", () => {
    const a = doc({});
    a.skills = { ...a.skills, engaging: { level: 1, percent: 30, status: "in-progress", lastPracticedAt: phone } };
    const b = doc({});
    b.skills = { ...b.skills, engaging: { level: 1, percent: 50, status: "in-progress" } };
    for (const [local, remote] of [[a, b], [b, a]]) {
      assert.deepEqual(mergeSynced(local, remote).skills.engaging, { level: 1, percent: 50, status: "in-progress", lastPracticedAt: phone });
    }
  });

  it("adds no practice time when neither device has one, and drops a malformed one", () => {
    const a = doc({});
    const b = doc({});
    b.skills = { ...b.skills, oars: { ...b.skills.oars, lastPracticedAt: "not a date" } };
    assert.equal("lastPracticedAt" in mergeSynced(a, b).skills.oars, false);
    assert.equal("lastPracticedAt" in mergeSynced(b, a).skills.oars, false);
  });

  it("the guest merge keeps the newer time too", () => {
    const guest = doc({});
    guest.skills = { ...guest.skills, oars: { level: 1, percent: 20, status: "in-progress", lastPracticedAt: phone } };
    const account = doc({});
    account.skills = { ...account.skills, oars: { level: 1, percent: 40, status: "in-progress", lastPracticedAt: tablet } };
    const out = mergeGuestIntoAccount(account, guest) as unknown as SyncedDoc;
    assert.equal(out.skills.oars.lastPracticedAt, phone);
    assert.equal(out.skills.oars.percent, 40);
  });
});
