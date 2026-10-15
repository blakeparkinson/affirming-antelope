import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEARNER_MOVES } from "../src/prompts/observer";
import { MARKER_STAGGER, STRONG_GAP, baseTier, isLearnerMove, liveMoments, moveLines, staggerTimes, type MoveLine } from "../src/liveMoves";
import type { Turn } from "../src/types";

describe("isLearnerMove", () => {
  it("knows every move code and nothing else", () => {
    for (const m of LEARNER_MOVES) assert.ok(isLearnerMove(m), m);
    for (const x of [undefined, null, "", "Open-Question", "change", "reflection", 3, {}]) assert.equal(isLearnerMove(x), false, String(x));
  });
});

describe("baseTier", () => {
  it("keeps closed, telling and pushing moves neutral, never negative", () => {
    for (const m of ["closed-question", "giving-information", "advice-without-permission", "confront", "other"] as const) assert.equal(baseTier(m), "weak", m);
  });

  it("pops the MI-consistent moves", () => {
    for (const m of ["open-question", "simple-reflection", "complex-reflection", "summary", "affirmation", "emphasize-autonomy", "seeking-collaboration", "advice-with-permission"] as const) {
      assert.equal(baseTier(m), "good", m);
    }
  });
});

describe("liveMoments", () => {
  const line = (id: string, move?: MoveLine["move"], drew?: MoveLine["drew"]): MoveLine => ({ id, move, drew });

  it("makes a complex reflection strong", () => {
    assert.deepEqual(liveMoments([line("a", "open-question"), line("b", "complex-reflection")]), { a: "good", b: "strong" });
  });

  it("makes the line that first draws change talk strong, once", () => {
    const tiers = liveMoments([line("a", "open-question", "sustain"), line("b", "simple-reflection", "change"), line("c", "affirmation", "change"), line("d", "open-question", "ambivalent"), line("e", "open-question", "change")]);
    assert.deepEqual(tiers, { a: "good", b: "strong", c: "good", d: "good", e: "good" });
  });

  it("rations complex reflections so it never fires every turn", () => {
    const moves = Array.from({ length: 7 }, (_, i) => line(`r${i}`, "complex-reflection"));
    const tiers = liveMoments(moves);
    const strong = moves.filter((m) => tiers[m.id] === "strong").map((m) => m.id);
    assert.deepEqual(strong, ["r0", "r3", "r6"]);
    // never two strong in a row
    for (let i = 1; i < moves.length; i++) assert.ok(!(tiers[moves[i].id] === "strong" && tiers[moves[i - 1].id] === "strong"));
    assert.equal(STRONG_GAP, 2);
  });

  it("lets the first change talk through right after a strong reflection", () => {
    const tiers = liveMoments([line("a", "complex-reflection", "ambivalent"), line("b", "open-question", "change"), line("c", "complex-reflection")]);
    assert.deepEqual(tiers, { a: "strong", b: "strong", c: "good" });
  });

  it("never celebrates a weak move, even one that draws change talk", () => {
    const tiers = liveMoments([line("a", "closed-question", "change"), line("b", "simple-reflection", "change")]);
    // the first change talk was spent on the closed question; it doesn't roll over
    assert.deepEqual(tiers, { a: "weak", b: "good" });
  });

  it("skips lines with no read, but still counts the change talk they drew", () => {
    const tiers = liveMoments([line("a", undefined, "change"), line("b", "open-question", "change")]);
    assert.deepEqual(tiers, { b: "good" });
    assert.deepEqual(liveMoments([]), {});
  });

  it("keeps a line's tier as later lines arrive", () => {
    const lines = [line("a", "complex-reflection", "sustain"), line("b", "open-question")];
    const before = liveMoments(lines);
    const after = liveMoments([...lines.slice(0, 1), { ...lines[1], drew: "change" }, line("c", "complex-reflection", "change")]);
    assert.equal(after.a, before.a);
    assert.equal(after.b, "strong");
  });
});

describe("moveLines", () => {
  const turns: Turn[] = [
    { id: "t0", speaker: "employee", text: "Hi.", stance: "change" },
    { id: "t1", speaker: "learner", text: "Hey.", move: "closed-question" },
    { id: "t2", speaker: "employee", text: "Sure.", stance: "ambivalent" },
    { id: "t3", speaker: "learner", text: "Tell me more.", move: "open-question" },
  ];

  it("pairs each learner line with the stance of the reply after it, ignoring the opening line", () => {
    assert.deepEqual(moveLines(turns), [
      { id: "t1", move: "closed-question", drew: "ambivalent" },
      { id: "t3", move: "open-question", drew: undefined },
    ]);
  });

  it("takes the stance of the reply still arriving", () => {
    assert.deepEqual(moveLines(turns, { t3: "change" })[1], { id: "t3", move: "open-question", drew: "change" });
    // the saved reply wins over a header for the same line
    assert.equal(moveLines(turns, { t1: "discord" })[0].drew, "ambivalent");
  });

  it("remembers the stance of a reply that was cut off before it said anything", () => {
    // t1's reply had a change header, then the learner cut in: no counterpart line follows it
    const cut: Turn[] = [
      { id: "t0", speaker: "employee", text: "Hi." },
      { id: "t1", speaker: "learner", text: "Sounds hard.", move: "simple-reflection" },
      { id: "t2", speaker: "learner", text: "Tell me more.", move: "open-question" },
      { id: "t3", speaker: "employee", text: "Well...", stance: "change" },
    ];
    const tiers = liveMoments(moveLines(cut, { t1: "change", t2: "change" }));
    // the first change talk was t1's; t2 doesn't celebrate it again
    assert.deepEqual(tiers, { t1: "strong", t2: "good" });
  });
});

describe("staggerTimes", () => {
  it("shows a lone marker the moment it arrives", () => {
    assert.deepEqual(staggerTimes([1000]), [1000]);
    assert.deepEqual(staggerTimes([1000], 500), [1000]);
  });

  it("staggers markers that arrive together", () => {
    assert.deepEqual(staggerTimes([1000, 1000, 1000]), [1000, 1000 + MARKER_STAGGER, 1000 + 2 * MARKER_STAGGER]);
    assert.ok(MARKER_STAGGER >= 60 && MARKER_STAGGER <= 80);
  });

  it("waits for the gap after the last marker shown", () => {
    assert.deepEqual(staggerTimes([1000], 980), [1050]);
    assert.deepEqual(staggerTimes([1000, 1010, 1300]), [1000, 1070, 1300]);
  });

  it("keeps order and handles nothing to show", () => {
    assert.deepEqual(staggerTimes([]), []);
    const out = staggerTimes([5, 5, 6, 200, 201], 0, 60);
    assert.deepEqual(out, [60, 120, 180, 240, 300]);
  });
});
