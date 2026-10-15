// Day keys are local calendar days: pin a zone with DST so the boundaries are real.
process.env.TZ = "America/Los_Angeles";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, freezeReveal, streakAfterPractice, type StreakFreezes } from "../src/habit";
import { freshSyncedDoc, mergeGuestIntoAccount, mergeSynced, upgradeDoc, type SyncedDoc } from "../src/learnerDoc";
import { markMilestone, mergeMilestones, milestoneCrossed, milestoneToCelebrate, STREAK_MILESTONES } from "../src/milestones";

// 2026-10-14 is a Wednesday; its week starts Monday 2026-10-12.
const WED = "2026-10-14";
const doc = (over: Partial<SyncedDoc>): SyncedDoc => ({ ...freshSyncedDoc("mi-for-leaders", "2026-09-01T00:00:00.000Z"), ...over });

describe("milestone thresholds", () => {
  it("are 3, 7, 14, 30, 50 and 100 days", () => {
    assert.deepEqual([...STREAK_MILESTONES], [3, 7, 14, 30, 50, 100]);
  });

  it("fire on the practice that reaches each one, and not the next", () => {
    for (const m of STREAK_MILESTONES) {
      assert.equal(milestoneCrossed(m - 1, m), m, `${m - 1} → ${m}`);
      assert.equal(milestoneCrossed(m, m + 1), null, `${m} → ${m + 1}`);
      // a second practice the same day doesn't move the streak
      assert.equal(milestoneCrossed(m, m), null, `${m} → ${m}`);
    }
  });

  it("stay quiet between milestones, past 100, and on a restart", () => {
    for (const [a, b] of [[0, 1], [1, 2], [3, 4], [7, 13], [100, 101], [250, 251], [12, 1], [0, 0]]) {
      assert.equal(milestoneCrossed(a, b), null, `${a} → ${b}`);
    }
  });

  it("celebrates only the highest when one jump crosses several", () => {
    assert.equal(milestoneCrossed(2, 8), 7);
    assert.equal(milestoneCrossed(0, 100), 100);
  });
});

describe("milestoneToCelebrate", () => {
  const run7 = { days: 7, lastPracticeDay: WED };

  it("celebrates a milestone this run hasn't", () => {
    assert.equal(milestoneToCelebrate(6, run7, []), 7);
    // 3 was celebrated earlier in this run: 7 is still new
    assert.equal(milestoneToCelebrate(6, run7, [{ days: 3, day: addDays(WED, -4) }]), 7);
  });

  it("doesn't replay one this run already celebrated, or when a higher one played", () => {
    assert.equal(milestoneToCelebrate(6, run7, [{ days: 7, day: WED }]), null);
    assert.equal(milestoneToCelebrate(6, run7, [{ days: 14, day: WED }]), null);
  });

  it("celebrates again on a new run after the streak broke", () => {
    // the 7 played on a run that ended before this one started (this run began Oct 8)
    assert.equal(milestoneToCelebrate(6, run7, [{ days: 7, day: "2026-09-20" }]), 7);
    assert.equal(milestoneToCelebrate(6, run7, [{ days: 7, day: addDays(WED, -7) }]), 7);
  });

  it("counts frozen days as part of the run they bridge", () => {
    // practised Oct 7-10, froze Oct 11, practised Oct 12-14: a 7-day run that began Oct 7
    const frozen = ["2026-10-11"];
    const seen = [{ days: 7, day: "2026-10-07" }];
    assert.equal(milestoneToCelebrate(6, run7, seen, frozen), null);
    assert.equal(milestoneToCelebrate(6, run7, seen, []), 7);
  });
});

describe("milestones across devices", () => {
  // Both devices practised every day up to Tuesday; the streak is 6.
  const tue = { days: 6, lastPracticeDay: addDays(WED, -1) };

  it("a second device doesn't replay a milestone the first one played", () => {
    // Wednesday: the phone practises, crosses 7 and celebrates.
    const phonePractice = streakAfterPractice(tue, WED, doc({}).freezes);
    assert.equal(milestoneToCelebrate(6, phonePractice.streak, []), 7);
    const phone = doc({ streak: phonePractice.streak, milestones: markMilestone([], 7, WED) });

    // The tablet syncs before it practises: the merged streak is already 7, nothing to cross.
    const tablet = doc({ streak: tue });
    const synced = mergeSynced(tablet, phone);
    const tabletPractice = streakAfterPractice(synced.streak, WED, synced.freezes);
    assert.equal(milestoneToCelebrate(synced.streak.days, tabletPractice.streak, synced.milestones, synced.freezes.usedDays), null);

    // The tablet practised offline first (6 → 7 on its own copy), then merged: still no replay.
    const offline = streakAfterPractice(tue, WED, tablet.freezes);
    const merged = mergeSynced(doc({ streak: offline.streak }), phone);
    assert.equal(milestoneToCelebrate(6, merged.streak, merged.milestones, merged.freezes.usedDays), null);
  });

  it("keeps every celebration either device saw, whichever side is stale", () => {
    const a = doc({ milestones: [{ days: 3, day: "2026-10-10" }] });
    const b = doc({ milestones: [{ days: 7, day: WED }] });
    const want = [
      { days: 3, day: "2026-10-10" },
      { days: 7, day: WED },
    ];
    assert.deepEqual(mergeSynced(a, b).milestones, want);
    assert.deepEqual(mergeSynced(b, a).milestones, want);
    assert.deepEqual(mergeMilestones(a.milestones, a.milestones), a.milestones);
  });

  it("an older app's document (no milestones) doesn't wipe this device's", () => {
    const local = doc({ milestones: [{ days: 7, day: WED }] });
    const { milestones: _, ...legacy } = doc({});
    assert.deepEqual(mergeSynced(local, legacy).milestones, local.milestones);
  });

  it("drops malformed entries from a stored document", () => {
    const up = upgradeDoc({ milestones: [{ days: 7, day: WED }, { days: "7", day: WED }, { days: 3 }, null, { days: 0, day: WED }, { days: 14, day: "yesterday" }] });
    assert.deepEqual(up.milestones, [{ days: 7, day: WED }]);
    assert.equal(upgradeDoc({ milestones: "lots" }).milestones, undefined);
  });

  it("survives the guest merge on sign-in", () => {
    const guest = doc({ milestones: [{ days: 3, day: WED }] });
    const merged = mergeGuestIntoAccount(doc({}), guest);
    assert.deepEqual(merged.milestones, [{ days: 3, day: WED }]);
  });
});

describe("freezeReveal", () => {
  const ONE: StreakFreezes = { earnedDays: [], usedDays: [] }; // holds the starting freeze
  const missedTue = { days: 12, lastPracticeDay: "2026-10-12" }; // practised Monday, missed Tuesday

  it("reveals the day a freeze covered on this week's pip, once", () => {
    const first = freezeReveal(missedTue, ONE, null, WED);
    assert.deepEqual(first.settled.used, ["2026-10-13"]);
    assert.deepEqual(first.reveal, { days: ["2026-10-13"], pips: [false, true, false, false, false, false, false], held: 0 });
    assert.equal(first.seenThrough, "2026-10-13");

    // opening Home again: already shown, and the freeze stays spent
    const again = freezeReveal(missedTue, first.settled.freezes, first.seenThrough, WED);
    assert.deepEqual(again.settled.used, []);
    assert.equal(again.reveal, null);
    assert.equal(again.seenThrough, "2026-10-13");
  });

  it("reveals a freeze another device spent", () => {
    const spent: StreakFreezes = { earnedDays: [], usedDays: ["2026-10-13"] };
    const r = freezeReveal(missedTue, spent, "2026-09-30", WED);
    assert.deepEqual(r.settled.used, []);
    assert.deepEqual(r.reveal?.days, ["2026-10-13"]);
    assert.deepEqual(r.reveal?.pips, [false, true, false, false, false, false, false]);
  });

  it("covers several days with several freezes", () => {
    const two: StreakFreezes = { earnedDays: ["2026-10-01"], usedDays: [] };
    const r = freezeReveal({ days: 12, lastPracticeDay: "2026-10-11" }, two, null, WED);
    assert.deepEqual(r.reveal, { days: ["2026-10-12", "2026-10-13"], pips: [true, true, false, false, false, false, false], held: 0 });
  });

  it("shows no reveal when the freezes ran out and the streak broke, but marks the days seen", () => {
    // one freeze, two missed days: Monday is frozen, Tuesday breaks the streak
    const r = freezeReveal({ days: 12, lastPracticeDay: "2026-10-11" }, ONE, null, WED);
    assert.equal(r.settled.alive, false);
    assert.equal(r.reveal, null);
    assert.equal(r.seenThrough, "2026-10-12");
  });

  it("gives last week's frozen day the note but no pip", () => {
    // Monday: Sunday was missed and frozen
    const r = freezeReveal({ days: 5, lastPracticeDay: "2026-10-10" }, ONE, null, "2026-10-12");
    assert.deepEqual(r.reveal?.days, ["2026-10-11"]);
    assert.deepEqual(r.reveal?.pips, [false, false, false, false, false, false, false]);
  });

  it("ignores frozen days more than a week old, and nothing to show without a freeze", () => {
    const old: StreakFreezes = { earnedDays: [], usedDays: ["2026-10-01"] };
    assert.equal(freezeReveal({ days: 3, lastPracticeDay: addDays(WED, -1) }, old, null, WED).reveal, null);
    assert.equal(freezeReveal({ days: 3, lastPracticeDay: addDays(WED, -1) }, ONE, null, WED).reveal, null);
  });
});
