import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FADED_BELOW,
  daysSincePracticed,
  fadedSkills,
  halfLifeDays,
  isFaded,
  laterPracticedAt,
  skillSharpness,
  type SharpnessInput,
} from "../src/sharpness";
import type { SkillLevelNumber } from "../src/types";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const skill = (level: SkillLevelNumber, daysAgo: number | null): SharpnessInput => ({
  level,
  status: "in-progress",
  ...(daysAgo === null ? {} : { lastPracticedAt: ago(daysAgo) }),
});

describe("skillSharpness: the decay curve", () => {
  it("is full on the day, half at the half-life, a quarter at two", () => {
    assert.equal(skillSharpness(skill(1, 0), NOW), 1);
    assert.equal(skillSharpness(skill(1, 10), NOW), 0.5);
    assert.equal(skillSharpness(skill(1, 20), NOW), 0.25);
  });

  it("is gentle: a level 1 skill is still over 90% sharp the next day", () => {
    assert.ok(skillSharpness(skill(1, 1), NOW)! > 0.9);
  });

  it("only goes down as the days pass, and stays within 0..1", () => {
    let prev = 1;
    for (let d = 0; d <= 400; d += 3) {
      const s = skillSharpness(skill(2, d), NOW)!;
      assert.ok(s <= prev && s > 0 && s <= 1, `day ${d}: ${s}`);
      prev = s;
    }
  });

  it("fades more slowly at higher levels", () => {
    for (let level = 1; level < 6; level++) {
      const lo = skillSharpness(skill(level as SkillLevelNumber, 14), NOW)!;
      const hi = skillSharpness(skill((level + 1) as SkillLevelNumber, 14), NOW)!;
      assert.ok(hi > lo, `level ${level + 1} should be sharper than ${level}`);
      assert.ok(halfLifeDays((level + 1) as SkillLevelNumber) > halfLifeDays(level as SkillLevelNumber));
    }
  });

  it("crosses the faded line after about a week at level 1, later at level 3", () => {
    assert.equal(isFaded(skill(1, 7), NOW), false);
    assert.equal(isFaded(skill(1, 8), NOW), true);
    assert.equal(isFaded(skill(3, 8), NOW), false);
    assert.equal(isFaded(skill(3, 17), NOW), true);
  });

  it("never lowers the stored level (it reads the skill and changes nothing)", () => {
    const p = { ...skill(4, 300), percent: 55 };
    const before = structuredClone(p);
    assert.ok(skillSharpness(p, NOW)! < 0.01);
    fadedSkills({ oars: p }, NOW);
    assert.deepEqual(p, before);
  });

  it("treats a practice time ahead of the clock (another device's) as just now", () => {
    assert.equal(skillSharpness(skill(1, -2), NOW), 1);
    assert.equal(daysSincePracticed(skill(1, -2), NOW), 0);
  });

  it("accepts a Date, an ISO string or a timestamp for now", () => {
    const p = skill(1, 10);
    assert.equal(skillSharpness(p, new Date(NOW)), 0.5);
    assert.equal(skillSharpness(p, new Date(NOW).toISOString()), 0.5);
  });
});

describe("skills that were never practised", () => {
  it("have no sharpness, so they never show as faded", () => {
    assert.equal(skillSharpness(skill(1, null), NOW), null);
    assert.equal(skillSharpness(undefined, NOW), null);
    assert.equal(daysSincePracticed(skill(1, null), NOW), null);
    assert.equal(isFaded(skill(1, null), NOW), false);
  });

  it("nor do locked skills, or a malformed time", () => {
    assert.equal(skillSharpness({ level: 1, status: "locked", lastPracticedAt: ago(30) }, NOW), null);
    assert.equal(skillSharpness({ level: 1, status: "in-progress", lastPracticedAt: "yesterday" }, NOW), null);
    assert.equal(skillSharpness({ level: 1, status: "in-progress", lastPracticedAt: "" }, NOW), null);
  });

  it("are left out of fadedSkills", () => {
    assert.deepEqual(fadedSkills({ oars: skill(1, null), engaging: skill(1, null) }, NOW), []);
  });
});

describe("fadedSkills", () => {
  it("lists only faded skills, least sharp first, with whole days since", () => {
    const out = fadedSkills({ oars: skill(1, 9), engaging: skill(1, 30), focusing: skill(1, 2), evoking: skill(1, null) }, NOW);
    assert.deepEqual(out.map((f) => f.skill), ["engaging", "oars"]);
    assert.equal(out[0].days, 30);
    assert.ok(out.every((f) => f.sharpness < FADED_BELOW));
  });

  it("keeps curriculum order on a tie", () => {
    const out = fadedSkills({ focusing: skill(1, 20), oars: skill(1, 20) }, NOW);
    assert.deepEqual(out.map((f) => f.skill), ["oars", "focusing"]);
  });
});

describe("laterPracticedAt", () => {
  it("keeps the later time from either side, and ignores missing or malformed ones", () => {
    assert.equal(laterPracticedAt(ago(3), ago(1)), ago(1));
    assert.equal(laterPracticedAt(ago(1), ago(3)), ago(1));
    assert.equal(laterPracticedAt(undefined, ago(3)), ago(3));
    assert.equal(laterPracticedAt(ago(3), null), ago(3));
    assert.equal(laterPracticedAt("nope", ago(3)), ago(3));
    assert.equal(laterPracticedAt(undefined, "nope"), undefined);
  });

  it("compares instants, not strings (an offset time vs a UTC one)", () => {
    // 09:00 at -05:00 is 14:00 UTC, later than 13:00 UTC though it sorts first as text
    assert.equal(laterPracticedAt("2026-10-15T13:00:00.000Z", "2026-10-15T09:00:00-05:00"), "2026-10-15T09:00:00-05:00");
  });
});
