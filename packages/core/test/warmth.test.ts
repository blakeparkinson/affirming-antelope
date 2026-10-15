import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rolePlayerMessages } from "../src/prompts/rolePlayer";
import type { Turn } from "../src/types";
import { STANCES, parseStanceTag, stanceVisual, warmthArc } from "../src/warmth";

describe("stanceVisual", () => {
  it("leans in, warms and glows on change", () => {
    const v = stanceVisual("change");
    assert.equal(v.key, "change");
    assert.ok(v.warmth > 0 && v.glow > 0 && v.scale > 1 && v.lift < 0);
    assert.equal(v.recoil, false);
  });

  it("sways at rest, untinted, on ambivalent", () => {
    const v = stanceVisual("ambivalent");
    assert.equal(v.warmth, 0);
    assert.ok(v.sway > 0);
    assert.equal(v.scale, 1);
    assert.equal(v.glow, 0);
  });

  it("sits back and cools a little on sustain", () => {
    const v = stanceVisual("sustain");
    assert.ok(v.warmth < 0 && v.warmth > -1);
    assert.ok(v.scale < 1 && v.lift > 0);
    assert.equal(v.recoil, false);
  });

  it("recoils, draws in and cools most on discord", () => {
    const v = stanceVisual("discord");
    assert.equal(v.recoil, true);
    assert.ok(v.squeeze < 1);
    assert.ok(v.warmth < stanceVisual("sustain").warmth);
  });

  it("orders warmth discord < sustain < ambivalent < change", () => {
    const w = (["discord", "sustain", "ambivalent", "change"] as const).map((s) => stanceVisual(s).warmth);
    assert.deepEqual([...w].sort((a, b) => a - b), w);
  });

  it("falls back to neutral for a missing or unknown stance", () => {
    for (const s of [undefined, null, "", "neutral", "Change", "happy", 3, {}]) {
      const v = stanceVisual(s);
      assert.equal(v.key, "neutral", String(s));
      assert.deepEqual({ ...v, key: "x" }, { key: "x", warmth: 0, scale: 1, lift: 0, tilt: 0, sway: 0, squeeze: 1, recoil: false, glow: 0 });
    }
  });

  it("covers every stance", () => {
    for (const s of STANCES) assert.equal(stanceVisual(s).key, s);
  });
});

describe("parseStanceTag", () => {
  it("strips a known tag and returns the stance", () => {
    assert.deepEqual(parseStanceTag("[change] I mean, maybe."), { done: true, stance: "change", text: "I mean, maybe." });
    assert.deepEqual(parseStanceTag("  [ Discord ]\nNo."), { done: true, stance: "discord", text: "No." });
  });

  it("waits while a tag may still be arriving", () => {
    for (const head of ["", "  ", "[", "[chan", "[ambivalent"]) assert.deepEqual(parseStanceTag(head), { done: false }, head);
  });

  it("passes a reply without a tag through untouched", () => {
    assert.deepEqual(parseStanceTag("I don't know."), { done: true, text: "I don't know." });
    // brackets that aren't a lone word stay: "[laughs] " would be stripped, a real phrase is not
    assert.deepEqual(parseStanceTag("[I said this before, okay?]"), { done: true, text: "[I said this before, okay?]" });
  });

  it("strips an unknown one-word tag without inventing a stance", () => {
    assert.deepEqual(parseStanceTag("[neutral] Fine."), { done: true, stance: undefined, text: "Fine." });
  });

  it("gives up on a partial tag when the stream ends", () => {
    assert.deepEqual(parseStanceTag("[chan", true), { done: true, text: "" });
    assert.deepEqual(parseStanceTag("", true), { done: true, text: "" });
  });

  it("reads a move tag before the stance tag, in either order", () => {
    assert.deepEqual(parseStanceTag("[complex-reflection] [change] Yeah."), { done: true, stance: "change", move: "complex-reflection", text: "Yeah." });
    assert.deepEqual(parseStanceTag("[sustain][Open-Question] No."), { done: true, stance: "sustain", move: "open-question", text: "No." });
    assert.deepEqual(parseStanceTag("[advice-without-permission] Hm."), { done: true, stance: undefined, move: "advice-without-permission", text: "Hm." });
  });

  it("waits for the stance tag after a move tag", () => {
    assert.deepEqual(parseStanceTag("[open-question] [amb"), { done: false });
    // no words yet: done, and the caller keeps reading until there are some
    assert.deepEqual(parseStanceTag("[open-question] "), { done: true, stance: undefined, move: "open-question", text: "" });
    assert.deepEqual(parseStanceTag("[open-question] [amb", true), { done: true, stance: undefined, move: "open-question", text: "" });
  });

  it("reads a tag written with spaces, capitals or underscores", () => {
    assert.deepEqual(parseStanceTag("[Complex Reflection] [Change] Yeah."), { done: true, stance: "change", move: "complex-reflection", text: "Yeah." });
    assert.deepEqual(parseStanceTag("[open_question] [sustain] No."), { done: true, stance: "sustain", move: "open-question", text: "No." });
    // still waiting while a spaced tag streams in
    assert.deepEqual(parseStanceTag("[Complex Ref"), { done: false });
  });

  it("leaves a bracketed phrase that isn't a tag in the reply", () => {
    assert.deepEqual(parseStanceTag("[I know] it's late."), { done: true, text: "[I know] it's late." });
    assert.deepEqual(parseStanceTag("[open-question] [I know] it's late."), { done: true, stance: undefined, move: "open-question", text: "[I know] it's late." });
  });

  it("strips no more than two tags", () => {
    assert.deepEqual(parseStanceTag("[summary] [change] [laughs] Okay."), { done: true, stance: "change", move: "summary", text: "[laughs] Okay." });
  });

  it("treats a long bracket run as text, not a tag", () => {
    const head = "[aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    assert.deepEqual(parseStanceTag(head), { done: true, text: head });
  });
});

describe("warmthArc", () => {
  const turns: Turn[] = [
    { id: "t0", speaker: "employee", text: "Hi." },
    { id: "t1", speaker: "learner", text: "Hey." },
    { id: "t2", speaker: "employee", text: "Sure.", stance: "ambivalent" },
    { id: "t3", speaker: "learner", text: "Tell me more." },
    { id: "t4", speaker: "employee", text: "Okay." },
    { id: "t5", speaker: "learner", text: "So..." },
    { id: "t6", speaker: "employee", text: "Yes!", stance: "change" },
  ];

  it("plots each counterpart line, preferring the live stance, then the reviewer's, then the start", () => {
    const arc = warmthArc(turns, { start: "sustain", annotations: [{ turnId: "t4", speaker: "employee", stance: "discord" }, { turnId: "t6", speaker: "employee", stance: "sustain" }] });
    assert.deepEqual(
      arc.map((p) => [p.turnId, p.stance, p.warmth]),
      [
        ["t0", "sustain", -0.5],
        ["t2", "ambivalent", 0],
        ["t4", "discord", -1],
        ["t6", "change", 1],
      ],
    );
  });

  it("reads unknown lines as neutral", () => {
    const arc = warmthArc([{ id: "t4", speaker: "employee", text: "Hm.", stance: "bogus" as never }]);
    assert.deepEqual(arc, [{ turnId: "t4", warmth: 0, stance: undefined }]);
    assert.deepEqual(warmthArc([]), []);
  });
});

describe("rolePlayerMessages", () => {
  it("replays the counterpart's earlier tags and leaves learner text alone", () => {
    const msgs = rolePlayerMessages([
      { speaker: "employee", text: "Opening." },
      { speaker: "learner", text: "Hi [change]" },
      { speaker: "employee", text: "Hm.", stance: "sustain" },
      { speaker: "learner", text: "Okay." },
      { speaker: "employee", text: "Untagged." },
    ]);
    assert.deepEqual(msgs, [
      { role: "user", content: "Hi [change]" },
      { role: "assistant", content: "[sustain] Hm." },
      { role: "user", content: "Okay." },
      { role: "assistant", content: "Untagged." },
    ]);
  });

  it("replays the move each reply answered before its stance", () => {
    const msgs = rolePlayerMessages([
      { speaker: "employee", text: "Opening.", stance: "sustain" },
      { speaker: "learner", text: "Sounds hard.", move: "complex-reflection" },
      { speaker: "employee", text: "It is.", stance: "ambivalent" },
      { speaker: "learner", text: "Okay?", move: "closed-question" },
      { speaker: "employee", text: "Untagged." },
      { speaker: "learner", text: "Hm." },
      { speaker: "employee", text: "Sure.", stance: "sustain" },
    ]);
    assert.deepEqual(msgs, [
      { role: "user", content: "Sounds hard." },
      { role: "assistant", content: "[complex-reflection] [ambivalent] It is." },
      { role: "user", content: "Okay?" },
      { role: "assistant", content: "Untagged." },
      { role: "user", content: "Hm." },
      { role: "assistant", content: "[sustain] Sure." },
    ]);
  });
});
