import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAY_PHASES,
  DAYLIGHT,
  blendHex,
  contrastRatio,
  dayPhase,
  landscapeFills,
  nextPhaseChange,
  phaseAt,
  textPhaseFor,
  type DayPhase,
} from "../src/daylight";

describe("dayPhase", () => {
  it("splits the day into dawn, day, dusk and night at the boundaries", () => {
    assert.equal(dayPhase(4.99), "night");
    assert.equal(dayPhase(5), "dawn");
    assert.equal(dayPhase(7.9), "dawn");
    assert.equal(dayPhase(8), "day");
    assert.equal(dayPhase(12), "day");
    assert.equal(dayPhase(17), "dusk");
    assert.equal(dayPhase(19.99), "dusk");
    assert.equal(dayPhase(20), "night");
    assert.equal(dayPhase(0), "night");
    assert.equal(dayPhase(23.5), "night");
  });

  it("wraps hours outside 0..24", () => {
    assert.equal(dayPhase(24 + 6), "dawn");
    assert.equal(dayPhase(-1), "night");
  });

  it("reads local time from a Date", () => {
    assert.equal(phaseAt(new Date(2026, 9, 15, 6, 30)), "dawn");
    assert.equal(phaseAt(new Date(2026, 9, 15, 13, 0)), "day");
    assert.equal(phaseAt(new Date(2026, 9, 15, 18, 45)), "dusk");
    assert.equal(phaseAt(new Date(2026, 9, 15, 2, 0)), "night");
  });
});

describe("nextPhaseChange", () => {
  it("finds the next boundary later the same day", () => {
    const at = nextPhaseChange(new Date(2026, 9, 15, 13, 20, 5));
    assert.equal(at.getDate(), 15);
    assert.equal(at.getHours(), 17);
    assert.equal(at.getMinutes(), 0);
  });

  it("rolls over midnight to dawn", () => {
    const at = nextPhaseChange(new Date(2026, 9, 15, 22, 0));
    assert.equal(at.getDate(), 16);
    assert.equal(at.getHours(), 5);
  });

  it("moves past a boundary it is sitting exactly on", () => {
    const at = nextPhaseChange(new Date(2026, 9, 15, 8, 0, 0));
    assert.equal(at.getHours(), 17);
  });
});

describe("textPhaseFor", () => {
  it("keeps the darker phase's text while the light fades", () => {
    assert.equal(textPhaseFor("day", "night"), "night");
    assert.equal(textPhaseFor("night", "dawn"), "night");
    assert.equal(textPhaseFor("dawn", "day"), "dawn");
    assert.equal(textPhaseFor("day", "dusk"), "dusk");
    assert.equal(textPhaseFor("dusk", "dusk"), "dusk");
  });
});

describe("caption contrast", () => {
  const AA = 4.5;
  const fills = landscapeFills();

  /** The background a caption sits on mid-fade: every wash drawn in DAY_PHASES order at its weight. */
  const lit = (fill: string, weights: Partial<Record<DayPhase, number>>) =>
    DAY_PHASES.reduce((c, p) => blendHex(c, DAYLIGHT[p].wash.color, DAYLIGHT[p].wash.alpha * (weights[p] ?? 0)), fill);

  const worst = (text: string, weights: Partial<Record<DayPhase, number>>) =>
    Math.min(...fills.map((f) => contrastRatio(text, lit(f, weights))));

  for (const phase of DAY_PHASES) {
    it(`keeps every ${phase} caption colour at AA on every ridge`, () => {
      for (const [role, text] of Object.entries(DAYLIGHT[phase].text)) {
        const r = worst(text, { [phase]: 1 });
        assert.ok(r >= AA, `${phase} ${role} ${text}: ${r.toFixed(2)}`);
      }
    });
  }

  it("stays at AA through every cross-fade", () => {
    for (const from of DAY_PHASES) {
      for (const to of DAY_PHASES) {
        const shown = DAYLIGHT[textPhaseFor(from, to)].text;
        for (const u of [0, 0.25, 0.5, 0.75, 1]) {
          const w = from === to ? { [to]: 1 } : { [from]: 1 - u, [to]: u };
          for (const [role, text] of Object.entries(shown)) {
            const r = worst(text, w);
            assert.ok(r >= AA, `${from}→${to} at ${u} ${role}: ${r.toFixed(2)}`);
          }
        }
      }
    }
  });

  it("dims the night and warms dawn and dusk", () => {
    const meadow = "#FBEED6";
    const day = lit(meadow, { day: 1 });
    assert.equal(day, meadow);
    assert.ok(contrastRatio("#FFFFFF", lit(meadow, { night: 1 })) > contrastRatio("#FFFFFF", lit(meadow, { dusk: 1 })));
  });
});
