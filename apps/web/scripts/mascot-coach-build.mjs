#!/usr/bin/env node
// Builds the "Coach" mascot .riv: one artboard holding the wave rig and the celebrate rig, one
// state machine ("Coach") driven by a view model ("Coach") through data binding.
//
//   python3 scripts/mascot-coach-layers.py   # cut the art (public/mascot-layers/coach)
//   node scripts/mascot-coach-build.mjs      # -> ../mobile/assets/rive/mascot-coach.riv
//
// Authoring goes through rive-mcp-server's scene writer (buildScene/writeRiv from the npx cache)
// plus two passes the server does not have: multi-condition transitions and view-model-bound
// conditions (scripts/rive-vm-conditions.mjs). The scene spec is also written to
// scripts/mascot-coach.scene.json for inspection with the rive-mcp tools.
//
// View model "Coach" (the state machine contract, see apps/mobile/DESIGN.md "Mascot"):
//   pose  number  0 wave, 1 celebrate, 2 head (wave art, raised arm hidden; the app crops it)
//   mood  number  0 idle, 1 listening, 2 thinking, 3 cheer (repeating happy hops)
//   still number  1 = reduced motion: the Idle layer keeps breathing but drops the head/ear/
//                 tail/scarf/arm drift (the app also skips wave/hop/cheer then)
//   wave, hop, cheer, nod, blink   triggers (one-shots; cheer swaps to the celebrate drawing
//                                   mid-air when pose is wave)
//
// Animation is authored at 60 fps. Layers, back to front: Pose, Idle, Mood, Blink, Action.
// Each layer keys its own nodes in a nested transform chain (e.g. head -> headMood -> headAct
// -> headIdle), so layers never fight over a property and their motion adds up.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { bindConditions } from "./rive-vm-conditions.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
const OUT_RIV = resolve(WEB, "../mobile/assets/rive/mascot-coach.riv");
const OUT_SCENE = resolve(HERE, "mascot-coach.scene.json");
const OUT_TS = resolve(WEB, "../mobile/src/components/mascot/coach.generated.ts");

function serverDist() {
  const root = join(homedir(), ".npm/_npx");
  for (const d of readdirSync(root)) {
    const p = join(root, d, "node_modules/rive-mcp-server/dist");
    if (existsSync(join(p, "rivWriter.js"))) return p;
  }
  throw new Error("rive-mcp-server not in the npx cache; run `npx -y rive-mcp-server` once");
}
const DIST = serverDist();
const { buildScene, writeRiv, pngSize } = await import(join(DIST, "rivWriter.js"));
const { loadDefs, encodeVaruintList } = await import(join(DIST, "rivBinary.js"));

const rig = JSON.parse(readFileSync(join(WEB, "public/mascot-layers/coach/rig.json"), "utf8"));

// ---------------------------------------------------------------- layout
export const ARTBOARD = { width: 820, height: 1140 };
// Where each drawing's top-left sits on the artboard (wave feet ~y 1078; celebrate aligned to it).
const OFFSET = { w: [73, 130], c: [58, 173] };
const INK = "#04091F";

// ---------------------------------------------------------------- easing (cubic-bezier)
const E = {
  inOut: [0.45, 0, 0.55, 1],
  out: [0.15, 0.75, 0.3, 1],
  outSoft: [0.25, 0.6, 0.35, 1],
  in: [0.55, 0, 0.9, 0.5],
  inSoft: [0.5, 0, 0.75, 0.45],
  snap: [0.7, 0, 0.1, 1],
  back: "ease-out-back",
  lin: "linear",
  hold: "hold",
};

// ---------------------------------------------------------------- scene assembly helpers
const groups = [];
const images = [];
const shapes = [];
const abs = new Map(); // node id -> absolute artboard position at rest
let z = 0;

function group(id, parent, at, extra = {}) {
  const p = parent ? abs.get(parent) : [0, 0];
  if (!p) throw new Error(`group ${id}: unknown parent ${parent}`);
  groups.push({ id, ...(parent ? { parent } : {}), x: +(at[0] - p[0]).toFixed(2), y: +(at[1] - p[1]).toFixed(2), ...extra });
  abs.set(id, at);
  return id;
}
function chain(prefix, parent, at, links) {
  // nested groups sharing one pivot, outer to inner: prefix, prefix+links[0], prefix+links[1], ...
  // (e.g. wHead > wHeadMood > wHeadAct > wHeadIdle); returns the innermost id
  let cur = group(prefix, parent, at);
  for (const l of links) cur = group(prefix + l, cur, at);
  return cur;
}
const A = (p, xy) => [OFFSET[p][0] + xy[0], OFFSET[p][1] + xy[1]];

function image(p, part, parent, extra = {}) {
  const meta = rig[p === "w" ? "wave" : "celebrate"];
  const info = meta.parts[part];
  const c = A(p, info.center);
  const pp = abs.get(parent);
  images.push({
    id: `${p}_${part}`,
    pngPath: `public/${info.file}`,
    parent,
    x: +(c[0] - pp[0]).toFixed(2),
    y: +(c[1] - pp[1]).toFixed(2),
    scale: +(1 / meta.scale).toFixed(5),
    z: z++,
    ...extra,
  });
}

// ---------------------------------------------------------------- rig
const POSES = ["w", "c"];
// raised-arm joints in wave-drawing pixels (must match "segments" in mascot-coach-layers.py)
const ELBOW = [163, 552];
const WRIST = [110, 478];
const eyeInfo = {};

for (const p of POSES) {
  const meta = rig[p === "w" ? "wave" : "celebrate"];
  const P = (part) => A(p, meta.parts[part].pivot);
  group(`${p}Pose`, undefined, [0, 0], { opacity: p === "w" ? 1 : 0 });
  // body chain at the feet: hop (y) -> squash (scale, rotation) -> breath (scale) -> lean (rotation)
  const lean = chain(`${p}Hop`, `${p}Pose`, P("body"), ["Squash", "Breath", "Lean"]);

  const tail = chain(`${p}Tail`, lean, P("tail"), ["Act", "Idle"]);
  image(p, "tail", tail);
  image(p, "body", lean);
  const armR = chain(`${p}ArmR`, lean, P("armR"), ["Act", "Idle"]);
  image(p, "armR", armR);

  if (p === "w") {
    // raised arm: one piece swung from the shoulder (scripts/mascot_cleanup.py merges the cut
    // shoulder/forearm/hoof back together; bending them apart showed their cut edges). The
    // elbow and wrist groups stay, empty, so older keys and the rest pose still resolve.
    const armL = chain(`${p}ArmL`, lean, P("armLUpper"), ["Vis", "Act", "Idle"]);
    const elbow = chain("wElbow", armL, A(p, ELBOW), ["Act"]);
    chain("wWrist", elbow, A(p, WRIST), ["Act"]);
    image(p, "armL", armL);
  } else {
    const armL = chain(`${p}ArmL`, lean, P("armL"), ["Act", "Idle"]);
    image(p, "armL", armL);
  }

  // head chain at the neck: mood (rot/x/y) -> act (rot/y/scale) -> idle (rot/y)
  const head = chain(`${p}Head`, lean, P("head"), ["Mood", "Act", "Idle"]);
  for (const side of ["L", "R"]) {
    const ear = chain(`${p}Ear${side}`, head, P(`ear${side}`), ["Mood", "Act", "Idle"]);
    image(p, `ear${side}`, ear);
  }
  image(p, "head", head);

  // eyes: clip polygon + group (clipped) holding iris (look), lash, lids
  const eyes = meta.eyes;
  const theta = (Math.atan2(eyes[1].center[1] - eyes[0].center[1], eyes[1].center[0] - eyes[0].center[0]) * 180) / Math.PI;
  for (const e of eyes) {
    const side = e.id.endsWith("L") ? "L" : "R";
    const c = A(p, e.center);
    const hp = abs.get(head);
    const clipId = `${p}EyeClip${side}`;
    shapes.push({
      id: clipId, type: "polygon", parent: head,
      x: +(c[0] - hp[0]).toFixed(2), y: +(c[1] - hp[1]).toFixed(2),
      points: e.clip.map(([x, y]) => ({ x: +(x - e.center[0]).toFixed(1), y: +(y - e.center[1]).toFixed(1) })),
      z: -1,
    });
    const eye = group(`${p}Eye${side}`, head, c, { clipBy: clipId });
    const look = group(`${p}Look${side}`, eye, c);
    image(p, `${e.id}Iris`, look);
    image(p, `${e.id}Lash`, eye);
    const lidRot = group(`${p}LidFrame${side}`, eye, c, { rotation: +theta.toFixed(2) });
    const [x0, y0, x1, y1] = e.bbox;
    const ew = x1 - x0;
    const eh = y1 - y0;
    // eye extents in the lid frame (the frame is rotated by the eye-line angle)
    const top = y0 - e.center[1];
    const bot = y1 - e.center[1];
    const up = { w: ew * 2.3, h: eh * 1.6 };
    const lo = { w: ew * 2.1, h: eh * 1.3 };
    // upper lid: fur; lower lid: the cream cheek (only rises for the nod/cheer squint)
    const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    const lid = hex(e.lid);
    const cheek = hex(e.lidLo);
    const info = {
      upOpen: top - 6 - up.h / 2,
      upClosed: bot + 6 - up.h / 2,
      loOpen: bot + 8 + lo.h / 2,
      loSquint: top + eh * 0.42 + lo.h / 2,
      upSquint: top - 6 - up.h / 2 + eh * 0.16,
      eh,
    };
    eyeInfo[`${p}${side}`] = info;
    shapes.push({
      id: `${p}LidLo${side}`, type: "ellipse", parent: lidRot, x: 0, y: +info.loOpen.toFixed(2), width: +lo.w.toFixed(1), height: +lo.h.toFixed(1),
      fill: { color: cheek }, stroke: { color: INK, thickness: 6 }, z: z++,
    });
    shapes.push({
      id: `${p}LidUp${side}`, type: "ellipse", parent: lidRot, x: 0, y: +info.upOpen.toFixed(2), width: +up.w.toFixed(1), height: +up.h.toFixed(1),
      fill: { color: lid }, stroke: { color: INK, thickness: 8 }, z: z++,
    });
    // the shut eye: a soft downward curve drawn over the closed lid (only visible mid-blink)
    const half = ew * 0.4;
    shapes.push({
      id: `${p}Shut${side}`, type: "polygon", closed: false, parent: lidRot, x: 0, y: 0, opacity: 0,
      points: Array.from({ length: 13 }, (_, i) => {
        const u = -1 + i / 6;
        return { x: +(u * half).toFixed(1), y: +(top + eh * 0.6 + eh * 0.13 * (1 - u * u)).toFixed(1) };
      }),
      stroke: { color: INK, thickness: 8, cap: "round", join: "round" }, z: z++,
    });
  }
  const neck = chain(`${p}Neck`, lean, P("neck"), ["Act", "Idle"]);
  image(p, "neck", neck);
}

// ---------------------------------------------------------------- keyframe helpers
const FPS = 60;
const f = (sec) => Math.round(sec * FPS);
const K = (frame, value, easing) => (easing ? { frame, value, easing } : { frame, value });
function track(target, property, keys) {
  return { target, property, keyframes: keys.map(([fr, v, e]) => K(fr, +v.toFixed(4), e)) };
}
// same keys on both rigs
const both = (suffix, property, keys) => POSES.map((p) => track(`${p}${suffix}`, property, keys));
// squash keys -> scaleX/scaleY with volume preservation (scaleX = 1/sqrt(scaleY))
function squash(target, keys) {
  return [
    track(target, "scaleY", keys),
    track(target, "scaleX", keys.map(([fr, v, e]) => [fr, 1 / Math.sqrt(v), e])),
  ];
}
const anims = [];
function anim(name, durationSec, loop, tracks) {
  anims.push({ name, fps: FPS, duration: f(durationSec), loop, tracks: tracks.flat(Infinity) });
}
// rest keys for every node a layer owns, so a layer's "rest" state really resets it
function rest(targets) {
  return targets.map(([t, prop, v]) => track(t, prop, [[0, v]]));
}

// ---------------------------------------------------------------- Pose layer
const POSE_KEYS = (wv, cv, arm) => [
  track("wPose", "opacity", [[0, wv]]),
  track("cPose", "opacity", [[0, cv]]),
  track("wArmLVis", "opacity", [[0, arm]]),
];
anim("pose_wave", 0.5, "loop", POSE_KEYS(1, 0, 1));
anim("pose_celebrate", 0.5, "loop", POSE_KEYS(0, 1, 1));
anim("pose_head", 0.5, "loop", POSE_KEYS(1, 0, 0));

// ---------------------------------------------------------------- Idle layer (always on)
// 6.4 s loop: two 3.2 s breaths; head, ears, scarf and tail follow the breath with lag (overlap),
// plus an ear flick and tail swishes at off-beat times so the loop doesn't read as a metronome.
{
  const D = 6.4;
  const T = (s) => f(s);
  const breath = [[0, 1], [T(1.45), 1.016, E.inOut], [T(3.2), 1, E.inOut], [T(4.65), 1.016, E.inOut], [T(6.4), 1, E.inOut]];
  const headRot = [[0, 0.3], [T(0.3), 0.3, E.inOut], [T(1.85), -0.9, E.inOut], [T(3.5), 0.4, E.inOut], [T(5.05), -0.8, E.inOut], [T(6.4), 0.3, E.inOut]];
  const headY = [[0, 0], [T(0.25), 0, E.inOut], [T(1.75), -3.2, E.inOut], [T(3.45), 0, E.inOut], [T(4.95), -3.2, E.inOut], [T(6.4), 0, E.inOut]];
  const earL = [[0, 0], [T(0.45), 0, E.inOut], [T(2.0), 2.2, E.inOut], [T(3.6), 0, E.inOut],
    // quick flick: snap up, overshoot back, settle
    [T(4.3), 0, E.inOut], [T(4.38), 11, E.out], [T(4.52), -3, E.inOut], [T(4.7), 1.5, E.inOut], [T(4.9), 0, E.inOut], [T(5.4), 1.8, E.inOut], [T(6.4), 0, E.inOut]];
  const earR = [[0, 0], [T(0.55), 0, E.inOut], [T(2.1), -2.4, E.inOut], [T(3.7), 0, E.inOut], [T(5.2), -2.2, E.inOut], [T(6.4), 0, E.inOut]];
  // tail (frames): a lazy pendulum with a quick double flick early and a three-swish wag late,
  // each snapping out and settling with shrinking overshoots
  const tail = [[0, 0], [18, -4, E.inOut], [54, 5, E.inOut], [66, 5, E.inOut], [71, -16, E.out], [78, 12, E.inOut],
    [85, -6, E.inOut], [96, 3, E.inOut], [144, -5, E.inOut], [192, 5, E.inOut], [246, 4, E.inOut], [251, -18, E.out],
    [259, 16, E.inOut], [268, -14, E.inOut], [276, 10, E.inOut], [286, -4, E.inOut], [297, 2, E.inOut], [342, -4, E.inOut], [384, 0, E.inOut]];
  const scarf = [[0, 0], [T(0.5), 0, E.inOut], [T(2.05), 0.9, E.inOut], [T(3.7), 0, E.inOut], [T(5.25), 0.9, E.inOut], [T(6.4), 0, E.inOut]];
  const armDrift = [[0, 0], [T(0.35), 0, E.inOut], [T(1.9), -1.6, E.inOut], [T(3.55), 0, E.inOut], [T(5.1), -1.6, E.inOut], [T(6.4), 0, E.inOut]];
  const armRDrift = [[0, 0], [T(0.5), 0, E.inOut], [T(2.0), 1.6, E.inOut], [T(3.7), 0, E.inOut], [T(5.2), 1.6, E.inOut], [T(6.4), 0, E.inOut]];
  // celebrate arms keep pumping gently (it's a jump pose); left and right out of phase
  const celArmL = [[0, 0], [T(0.8), 3, E.inOut], [T(2.4), -2, E.inOut], [T(4.0), 3, E.inOut], [T(5.6), -2, E.inOut], [T(6.4), 0, E.inOut]];
  const celArmR = [[0, 0], [T(0.8), -3, E.inOut], [T(2.4), 2, E.inOut], [T(4.0), -3, E.inOut], [T(5.6), 2, E.inOut], [T(6.4), 0, E.inOut]];
  const drift = [
    both("HeadIdle", "rotation", headRot),
    both("HeadIdle", "y", headY),
    both("EarLIdle", "rotation", earL),
    both("EarRIdle", "rotation", earR),
    both("TailIdle", "rotation", tail),
    both("NeckIdle", "rotation", scarf),
    track("wArmLIdle", "rotation", armDrift),
    track("wArmRIdle", "rotation", armRDrift),
    track("cArmLIdle", "rotation", celArmL),
    track("cArmRIdle", "rotation", celArmR),
  ];
  const breathing = POSES.map((p) => squash(`${p}HopBreath`, breath));
  anim("idle", D, "loop", [breathing, drift]);
  // reduced motion (view model `still` = 1): breathing only; every drifting node holds its rest
  anim("idle_still", D, "loop", [breathing, drift.flat(Infinity).map((t) => track(t.target, t.property, [[0, 0]]))]);
}

// ---------------------------------------------------------------- Mood layer
// owns: <p>Lean rotation, <p>HeadMood rot/x/y, <p>Ear*Mood rotation, <p>Look* x/y
const MOOD_TARGETS = POSES.flatMap((p) => [
  [`${p}HopLean`, "rotation", 0],
  [`${p}HeadMood`, "rotation", 0], [`${p}HeadMood`, "x", 0], [`${p}HeadMood`, "y", 0],
  [`${p}EarLMood`, "rotation", 0], [`${p}EarRMood`, "rotation", 0],
  [`${p}LookL`, "x", 0], [`${p}LookL`, "y", 0], [`${p}LookR`, "x", 0], [`${p}LookR`, "y", 0],
]);
function moodPose(o) {
  // o: { lean, tilt, hx, hy, earL, earR, lx, ly } -> list of [target, prop, value]
  return POSES.flatMap((p) => [
    [`${p}HopLean`, "rotation", o.lean], [`${p}HeadMood`, "rotation", o.tilt],
    [`${p}HeadMood`, "x", o.hx], [`${p}HeadMood`, "y", o.hy],
    [`${p}EarLMood`, "rotation", o.earL], [`${p}EarRMood`, "rotation", o.earR],
    [`${p}LookL`, "x", o.lx], [`${p}LookL`, "y", o.ly], [`${p}LookR`, "x", o.lx], [`${p}LookR`, "y", o.ly],
  ]);
}
const LISTEN = { lean: 1.4, tilt: 6.5, hx: 6, hy: 4, earL: 13, earR: -13, lx: 5, ly: -7 };
const THINK = { lean: -1.2, tilt: -5.5, hx: -5, hy: 2, earL: -6, earR: -10, lx: -6, ly: -9 };
anim("mood_idle", 0.5, "loop", rest(MOOD_TARGETS));
// into listening: ears perk first (overshoot), head tilts after (overlap), eyes lift last
function moodIn(o, earLead) {
  const tr = [];
  for (const p of POSES) {
    tr.push(track(`${p}EarLMood`, "rotation", [[0, 0], [f(0.16), o.earL * 1.35, E.out], [f(0.34), o.earL * 0.9, E.inOut], [f(0.5), o.earL, E.inOut]]));
    tr.push(track(`${p}EarRMood`, "rotation", [[0, 0], [f(0.04 + earLead), 0], [f(0.2 + earLead), o.earR * 1.35, E.out], [f(0.38 + earLead), o.earR * 0.9, E.inOut], [f(0.55), o.earR, E.inOut]]));
    tr.push(track(`${p}HeadMood`, "rotation", [[0, 0], [f(0.08), 0], [f(0.42), o.tilt * 1.08, E.outSoft], [f(0.6), o.tilt, E.inOut]]));
    tr.push(track(`${p}HeadMood`, "x", [[0, 0], [f(0.08), 0], [f(0.45), o.hx, E.outSoft]]));
    tr.push(track(`${p}HeadMood`, "y", [[0, 0], [f(0.08), 0], [f(0.45), o.hy, E.outSoft]]));
    tr.push(track(`${p}HopLean`, "rotation", [[0, 0], [f(0.1), 0], [f(0.55), o.lean, E.inOut]]));
    for (const s of ["L", "R"]) {
      tr.push(track(`${p}Look${s}`, "x", [[0, 0], [f(0.14), 0], [f(0.36), o.lx, E.out]]));
      tr.push(track(`${p}Look${s}`, "y", [[0, 0], [f(0.14), 0], [f(0.36), o.ly, E.out]]));
    }
  }
  return tr;
}
anim("listen_in", 0.6, "oneShot", moodIn(LISTEN, 0.03));
// listening hold: a small "mm-hm" bob every ~2.6 s, ears twitch, eyes stay on the text
anim("listen", 5.2, "loop", POSES.flatMap((p) => [
  track(`${p}HeadMood`, "rotation", [[0, LISTEN.tilt], [f(1.3), LISTEN.tilt + 1.2, E.inOut], [f(2.6), LISTEN.tilt, E.inOut], [f(3.9), LISTEN.tilt + 1.0, E.inOut], [f(5.2), LISTEN.tilt, E.inOut]]),
  track(`${p}HeadMood`, "y", [[0, LISTEN.hy], [f(2.0), LISTEN.hy], [f(2.15), LISTEN.hy + 5, E.inOut], [f(2.45), LISTEN.hy, E.outSoft], [f(5.2), LISTEN.hy]]),
  track(`${p}HeadMood`, "x", [[0, LISTEN.hx]]),
  track(`${p}EarLMood`, "rotation", [[0, LISTEN.earL], [f(3.3), LISTEN.earL], [f(3.38), LISTEN.earL + 7, E.out], [f(3.55), LISTEN.earL - 2, E.inOut], [f(3.75), LISTEN.earL, E.inOut], [f(5.2), LISTEN.earL]]),
  track(`${p}EarRMood`, "rotation", [[0, LISTEN.earR], [f(1.0), LISTEN.earR], [f(1.08), LISTEN.earR - 6, E.out], [f(1.25), LISTEN.earR + 2, E.inOut], [f(1.45), LISTEN.earR, E.inOut], [f(5.2), LISTEN.earR]]),
  track(`${p}HopLean`, "rotation", [[0, LISTEN.lean]]),
  ...["L", "R"].flatMap((s) => [
    track(`${p}Look${s}`, "x", [[0, LISTEN.lx], [f(2.4), LISTEN.lx], [f(2.6), LISTEN.lx - 3, E.inOut], [f(3.6), LISTEN.lx - 3], [f(3.85), LISTEN.lx, E.inOut], [f(5.2), LISTEN.lx]]),
    track(`${p}Look${s}`, "y", [[0, LISTEN.ly]]),
  ]),
]));
anim("think_in", 0.6, "oneShot", moodIn(THINK, 0.08));
// thinking hold: slow head sway, eyes drift across the "ceiling", one ear lazily rotates
anim("think", 6, "loop", POSES.flatMap((p) => [
  track(`${p}HeadMood`, "rotation", [[0, THINK.tilt], [f(1.5), THINK.tilt - 1.6, E.inOut], [f(3), THINK.tilt, E.inOut], [f(4.5), THINK.tilt - 1.2, E.inOut], [f(6), THINK.tilt, E.inOut]]),
  track(`${p}HeadMood`, "x", [[0, THINK.hx]]),
  track(`${p}HeadMood`, "y", [[0, THINK.hy]]),
  track(`${p}EarLMood`, "rotation", [[0, THINK.earL], [f(3), THINK.earL - 4, E.inOut], [f(6), THINK.earL, E.inOut]]),
  track(`${p}EarRMood`, "rotation", [[0, THINK.earR], [f(2), THINK.earR + 3, E.inOut], [f(4.2), THINK.earR, E.inOut], [f(6), THINK.earR]]),
  track(`${p}HopLean`, "rotation", [[0, THINK.lean]]),
  ...["L", "R"].flatMap((s) => [
    track(`${p}Look${s}`, "x", [[0, THINK.lx], [f(1.6), THINK.lx], [f(1.85), THINK.lx + 8, E.inOut], [f(3.4), THINK.lx + 8], [f(3.65), THINK.lx, E.inOut], [f(6), THINK.lx]]),
    track(`${p}Look${s}`, "y", [[0, THINK.ly], [f(1.6), THINK.ly], [f(1.85), THINK.ly + 1, E.inOut], [f(3.65), THINK.ly, E.inOut], [f(6), THINK.ly]]),
  ]),
]));

// ---------------------------------------------------------------- Blink layer
// four open-hold lengths chained A->B->C->D->A (2.9/4.3/1.7/5.4 s, one double blink) so blinks
// never fall on a beat; the `blink` trigger jumps straight to a blink.
const LIDS = POSES.flatMap((p) => ["L", "R"].map((s) => [`${p}${s}`, eyeInfo[`${p}${s}`]]));
function blinkTracks(at, dbl, dur) {
  // close 100 ms (accelerate), hold 50 ms, open 167 ms (decelerate); the shut-eye curve shows
  // only while the lid is down
  return LIDS.flatMap(([ps, e]) => {
    const [p, side] = [ps[0], ps[1]];
    const y = [[0, e.upOpen]];
    const o = [[0, 0]];
    const one = (t) => {
      const s = f(t);
      if (s > 0) y.push([s, e.upOpen]);
      y.push([s + 6, e.upClosed, E.in], [s + 9, e.upClosed], [s + 19, e.upOpen, E.out]);
      // the curve cuts out as the lid starts up (fading it while the lid rose ghosted it over the iris)
      o.push([s + 4, 0], [s + 6, 1, E.hold], [s + 9, 0, E.hold]);
    };
    one(at);
    if (dbl) one(at + 0.42);
    y.push([f(dur), e.upOpen]);
    o.push([f(dur), 0]);
    return [track(`${p}LidUp${side}`, "y", y), track(`${p}Shut${side}`, "opacity", o)];
  });
}
function blinkAnim(name, dur, at, dbl = false) {
  anim(name, dur, "oneShot", blinkTracks(at, dbl, dur));
}
blinkAnim("blink_a", 2.9, 2.55);
blinkAnim("blink_b", 4.3, 3.6, true);
blinkAnim("blink_c", 1.7, 1.38);
blinkAnim("blink_d", 5.4, 5.05);
blinkAnim("blink_now", 0.36, 0.0);

// ---------------------------------------------------------------- Action layer
// owns: <p>Hop y, <p>HopSquash scale/rotation, <p>HeadAct rot/y, <p>Ear*Act rot, <p>TailAct rot,
// <p>NeckAct rot, <p>Arm*Act rot, wElbowAct/wWristAct rot, lower lids y (squint)
const ACTION_TARGETS = [
  ...POSES.flatMap((p) => [
    [`${p}Hop`, "y", abs.get(`${p}Hop`)[1] - abs.get(`${p}Pose`)[1]],
    [`${p}HopSquash`, "scaleX", 1], [`${p}HopSquash`, "scaleY", 1], [`${p}HopSquash`, "rotation", 0],
    [`${p}HeadAct`, "rotation", 0], [`${p}HeadAct`, "y", 0], [`${p}HeadAct`, "scaleX", 1], [`${p}HeadAct`, "scaleY", 1],
    [`${p}EarLAct`, "rotation", 0], [`${p}EarRAct`, "rotation", 0],
    [`${p}TailAct`, "rotation", 0], [`${p}NeckAct`, "rotation", 0],
    [`${p}ArmRAct`, "rotation", 0],
    [p === "w" ? "wArmLAct" : "cArmLAct", "rotation", 0],
    [`${p}LidLoL`, "y", eyeInfo[`${p}L`].loOpen], [`${p}LidLoR`, "y", eyeInfo[`${p}R`].loOpen],
  ]),
  ["wElbowAct", "rotation", 0], ["wWristAct", "rotation", 0],
];
const restY = (p) => abs.get(`${p}Hop`)[1] - abs.get(`${p}Pose`)[1];
anim("act_rest", 0.5, "loop", rest(ACTION_TARGETS));

// ears react to vertical motion with lag: droop (tips down) on the way up / at landing, flip up at the apex
function earsFollow(p, keys) {
  // keys: [frame, amount] where +amount = tips up
  return [
    track(`${p}EarLAct`, "rotation", keys.map(([fr, v, e]) => [fr, v, e])),
    track(`${p}EarRAct`, "rotation", keys.map(([fr, v, e]) => [fr, -v, e])),
  ];
}

function hopTracks(scale = 1, { squint = false, armsUp = false } = {}) {
  // anticipation squash -> launch stretch -> apex -> fall -> landing squash -> rebound -> settle
  const H = 92 * scale;
  const tr = [];
  const t = { ant: 7, launch: 13, apex: 25, land: 37, low: 42, re: 52, settle: 62, end: 80 };
  for (const p of POSES) {
    const y0 = restY(p);
    tr.push(track(`${p}Hop`, "y", [[0, y0], [t.ant, y0], [t.launch, y0 - H * 0.42, E.lin], [t.apex, y0 - H, E.out], [t.land, y0, E.in], [t.end, y0]]));
    const k = Math.pow(scale, 0.6); // bigger jumps squash a little more, not proportionally more
    const sq = [[0, 1], [t.ant, 1 - 0.11 * k, E.out], [t.launch, 1 + 0.09 * k, E.out], [t.apex, 1.0, E.inOut],
      [t.land - 3, 1 + 0.045 * k, E.in], [t.low, 1 - 0.115 * k, E.out], [t.re, 1 + 0.03 * k, E.inOut], [t.settle, 0.99, E.inOut], [t.end, 1, E.inOut]];
    tr.push(...squash(`${p}HopSquash`, sq));
    // the skull is stiffer than the body: undo most of the squash on the head so it stays on model
    tr.push(track(`${p}HeadAct`, "scaleY", sq.map(([fr, v, e]) => [fr, Math.pow(v, -0.65), e])));
    tr.push(track(`${p}HeadAct`, "scaleX", sq.map(([fr, v, e]) => [fr, Math.pow(1 / Math.sqrt(v), -0.65), e])));
    // head drags behind the body: drops on the squash, lags on launch, bobs on landing
    tr.push(track(`${p}HeadAct`, "y", [[0, 0], [t.ant + 2, 7 * scale, E.out], [t.launch + 3, -5 * scale, E.inOut], [t.apex + 2, 1, E.inOut],
      [t.low + 2, 9 * scale, E.out], [t.re + 3, -2.5 * scale, E.inOut], [t.end, 0, E.inOut]]));
    tr.push(...earsFollow(p, [[0, 0], [t.ant + 2, -8 * scale, E.out], [t.launch + 4, -14 * scale, E.inOut], [t.apex + 3, 10 * scale, E.inOut],
      [t.land, 6 * scale, E.inOut], [t.low + 3, -12 * scale, E.out], [t.re + 4, 5 * scale, E.inOut], [t.settle + 6, -1.5, E.inOut], [t.end, 0, E.inOut]]));
    tr.push(track(`${p}TailAct`, "rotation", [[0, 0], [t.ant + 2, -10, E.out], [t.apex, 16, E.inOut], [t.low + 2, -14, E.out], [t.re + 6, 6, E.inOut], [t.end, 0, E.inOut]]));
    tr.push(track(`${p}NeckAct`, "rotation", [[0, 0], [t.launch + 2, -2.2, E.inOut], [t.apex + 4, 1.8, E.inOut], [t.low + 3, -1.6, E.inOut], [t.end, 0, E.inOut]]));
    if (p === "c" || armsUp) {
      const armL = p === "w" ? "wArmLAct" : "cArmLAct";
      // arms: drop on the squash, fling up on launch, overshoot at the apex
      tr.push(track(armL, "rotation", [[0, 0], [t.ant + 1, -7, E.out], [t.launch + 3, 9, E.out], [t.apex + 4, -3, E.inOut], [t.low + 2, -6, E.out], [t.re + 6, 2, E.inOut], [t.end, 0, E.inOut]]));
      tr.push(track(`${p}ArmRAct`, "rotation", [[0, 0], [t.ant + 1, 7, E.out], [t.launch + 3, -9, E.out], [t.apex + 4, 3, E.inOut], [t.low + 2, 6, E.out], [t.re + 6, -2, E.inOut], [t.end, 0, E.inOut]]));
    } else {
      // wave pose: hanging arm swings out on take-off and back (follow-through)
      tr.push(track(`${p}ArmRAct`, "rotation", [[0, 0], [t.ant + 2, 4, E.out], [t.apex, -10, E.inOut], [t.low + 2, 6, E.out], [t.re + 6, -2, E.inOut], [t.end, 0, E.inOut]]));
      tr.push(track("wArmLAct", "rotation", [[0, 0], [t.ant + 2, 3, E.out], [t.apex, -5, E.inOut], [t.low + 2, 4, E.out], [t.end, 0, E.inOut]]));
    }
    if (squint) {
      // happy squint: cheeks push the lower lids up into a crescent, upper lids ease down a touch
      for (const s of ["L", "R"]) {
        const e = eyeInfo[`${p}${s}`];
        tr.push(track(`${p}LidLo${s}`, "y", [[0, e.loOpen], [t.launch, e.loOpen], [t.apex - 2, e.loSquint, E.out], [t.re + 10, e.loSquint], [t.end, e.loOpen, E.inOut]]));
        tr.push(track(`${p}LidUp${s}`, "y", [[0, e.upOpen], [t.launch, e.upOpen], [t.apex - 2, e.upSquint, E.out], [t.re + 10, e.upSquint], [t.end, e.upOpen, E.inOut]]));
      }
    }
  }
  return tr;
}
anim("hop", 80 / FPS, "oneShot", hopTracks(1));

// nod: "yes, that's it" - head dips with a squash, rebounds, smaller second dip; ears lag
anim("nod", 0.95, "oneShot", POSES.flatMap((p) => [
  track(`${p}HeadAct`, "y", [[0, 0], [f(0.1), -4, E.out], [f(0.24), 21, E.inOut], [f(0.42), -4, E.inOut], [f(0.56), 9, E.inOut], [f(0.72), -1, E.inOut], [f(0.95), 0, E.inOut]]),
  // foreshortening: the face shortens as it tips down
  track(`${p}HeadAct`, "scaleY", [[0, 1], [f(0.1), 1.01, E.out], [f(0.24), 0.955, E.inOut], [f(0.42), 1.008, E.inOut], [f(0.56), 0.98, E.inOut], [f(0.95), 1, E.inOut]]),
  track(`${p}HeadAct`, "rotation", [[0, 0], [f(0.24), 1.5, E.inOut], [f(0.56), 0.8, E.inOut], [f(0.95), 0, E.inOut]]),
  ...earsFollow(p, [[0, 0], [f(0.14), 4, E.out], [f(0.3), -9, E.inOut], [f(0.48), 5, E.inOut], [f(0.62), -4, E.inOut], [f(0.8), 1.5, E.inOut], [f(0.95), 0, E.inOut]]),
  ...squash(`${p}HopSquash`, [[0, 1], [f(0.24), 0.975, E.inOut], [f(0.42), 1.006, E.inOut], [f(0.56), 0.99, E.inOut], [f(0.95), 1, E.inOut]]),
  track(`${p}NeckAct`, "rotation", [[0, 0], [f(0.3), 1.2, E.inOut], [f(0.6), -0.6, E.inOut], [f(0.95), 0, E.inOut]]),
  // a contented half-squint at the bottom of the nod
  ...["L", "R"].map((s) => {
    const e = eyeInfo[`${p}${s}`];
    const mid = e.loOpen + (e.loSquint - e.loOpen) * 0.45;
    return track(`${p}LidLo${s}`, "y", [[0, e.loOpen], [f(0.12), e.loOpen], [f(0.26), mid, E.out], [f(0.6), mid], [f(0.85), e.loOpen, E.inOut]]);
  }),
]));

// wave: the whole raised arm swings from the shoulder in two and a half smooth arcs (~2 per
// second), opening outward only so the hoof never crosses the face.
{
  const sh = [[0, 0], [10, 1.5, E.inOut], [24, -9, E.inOut], [38, 0.5, E.inOut], [52, -9, E.inOut], [66, 0.5, E.inOut], [80, -7, E.inOut], [96, 0, E.inOut], [110, 0, E.inOut]];
  const tr = [track("wArmLAct", "rotation", sh)];
  // celebrate pose: the raised right arm waves (whole-arm swings), left arm bounces along
  tr.push(track("cArmRAct", "rotation", [[0, 0], [10, -6, E.inOut], [21, 12, E.out], [32, -2, E.inOut], [43, 12, E.inOut], [54, -1, E.inOut], [66, 9, E.inOut], [84, -1.5, E.inOut], [100, 0, E.inOut]]));
  tr.push(track("cArmLAct", "rotation", [[0, 0], [16, -3, E.inOut], [40, 2, E.inOut], [64, -2, E.inOut], [100, 0, E.inOut]]));
  for (const p of POSES) {
    // head leans toward the waving hand, ears flick on the first swing, body sways with the arm
    const dir = p === "w" ? -1 : 1;
    tr.push(track(`${p}HeadAct`, "rotation", [[0, 0], [8, 0.8 * -dir, E.inOut], [26, 4 * dir, E.out], [70, 3 * dir, E.inOut], [104, 0, E.inOut]]));
    tr.push(track(`${p}HeadAct`, "y", [[0, 0], [10, 3, E.inOut], [24, -2, E.out], [44, 0, E.inOut]]));
    tr.push(...earsFollow(p, [[0, 0], [12, 3, E.inOut], [22, 12, E.out], [32, -2, E.inOut], [44, 5, E.inOut], [60, 0, E.inOut]]));
    tr.push(track(`${p}HopSquash`, "rotation", [[0, 0], [12, 0.6 * -dir, E.inOut], [30, 1.3 * dir, E.inOut], [72, 0.9 * dir, E.inOut], [104, 0, E.inOut]]));
    tr.push(track(`${p}TailAct`, "rotation", [[0, 0], [18, 8, E.inOut], [34, -6, E.inOut], [50, 7, E.inOut], [66, -4, E.inOut], [90, 0, E.inOut]]));
    // a little bounce of "hi!" on the first two swings
    const y0 = restY(p);
    tr.push(track(`${p}Hop`, "y", [[0, y0], [10, y0, E.inOut], [22, y0 - 6, E.out], [34, y0, E.in], [46, y0 - 3.5, E.out], [58, y0, E.in], [110, y0]]));
    tr.push(...squash(`${p}HopSquash`, [[0, 1], [10, 0.985, E.inOut], [22, 1.016, E.out], [34, 0.99, E.in], [46, 1.008, E.out], [60, 1, E.inOut], [110, 1]]));
  }
  anim("wave", 110 / FPS, "oneShot", tr);
}

// cheer: deep anticipation -> leap (bigger hop) with arms up and a happy squint; in the wave pose
// the drawing is swapped for the celebrate drawing at the bottom of the squash and back at landing.
function cheerTracks(swap) {
  const tr = hopTracks(1.55, { squint: true, armsUp: true });
  if (swap) {
    // replacement: wave art squashes, celebrate art is in the air, wave art takes the landing
    tr.push(track("wPose", "opacity", [[0, 1], [8, 1], [9, 0, E.hold], [38, 0], [39, 1, E.hold], [80, 1]]));
    tr.push(track("cPose", "opacity", [[0, 0], [8, 0], [9, 1, E.hold], [38, 1], [39, 0, E.hold], [80, 0]]));
  }
  return tr;
}
anim("cheer", 80 / FPS, "oneShot", cheerTracks(true));
anim("cheer_stay", 80 / FPS, "oneShot", cheerTracks(false));
// cheer mood: a happy hop every 2.4 s
anim("cheer_loop", 2.4, "loop", hopTracks(1.2, { squint: true, armsUp: false }));

// ---------------------------------------------------------------- state machine
const TRIGGERS = ["wave", "hop", "cheer", "nod", "blink"];
const inputs = [{ name: "pose", type: "number" }, { name: "mood", type: "number" }, ...TRIGGERS.map((name) => ({ name, type: "trigger" })), { name: "still", type: "number" }];
const is = (input, value) => ({ input, op: "==", value });
const isnt = (input, value) => ({ input, op: "!=", value });
const fire = (input) => ({ input });

const layerPose = {
  name: "Pose",
  states: [{ name: "pose_wave", animation: "pose_wave" }, { name: "pose_celebrate", animation: "pose_celebrate" }, { name: "pose_head", animation: "pose_head" }],
  transitions: [{ from: "entry", to: "pose_wave" }],
};
{
  const names = ["pose_wave", "pose_celebrate", "pose_head"];
  for (const from of names) names.forEach((to, v) => { if (to !== from) layerPose.transitions.push({ from, to, conditions: [is("pose", v)] }); });
}
const layerIdle = {
  name: "Idle",
  states: [{ name: "idle", animation: "idle" }, { name: "idle_still", animation: "idle_still" }],
  transitions: [
    { from: "entry", to: "idle" },
    { from: "idle", to: "idle_still", conditions: [is("still", 1)], durationMs: 300 },
    { from: "idle_still", to: "idle", conditions: [isnt("still", 1)], durationMs: 300 },
  ],
};

const layerMood = {
  name: "Mood",
  states: ["mood_idle", "listen_in", "listen", "think_in", "think"].map((n) => ({ name: n, animation: n })),
  transitions: [
    { from: "entry", to: "mood_idle" },
    { from: "mood_idle", to: "listen_in", conditions: [is("mood", 1)] },
    { from: "mood_idle", to: "think_in", conditions: [is("mood", 2)] },
    { from: "listen_in", to: "listen", exitTimeMs: 600 },
    { from: "think_in", to: "think", exitTimeMs: 600 },
    ...["listen_in", "listen"].flatMap((s) => [
      { from: s, to: "think_in", conditions: [is("mood", 2)], durationMs: 120 },
      { from: s, to: "mood_idle", conditions: [isnt("mood", 1)], durationMs: 420 },
    ]),
    ...["think_in", "think"].flatMap((s) => [
      { from: s, to: "listen_in", conditions: [is("mood", 1)], durationMs: 120 },
      { from: s, to: "mood_idle", conditions: [isnt("mood", 2)], durationMs: 420 },
    ]),
  ],
};

const layerBlink = {
  name: "Blink",
  states: ["blink_a", "blink_b", "blink_c", "blink_d", "blink_now"].map((n) => ({ name: n, animation: n })),
  transitions: [
    { from: "entry", to: "blink_a" },
    { from: "blink_a", to: "blink_b", exitTimeMs: 2900 },
    { from: "blink_b", to: "blink_c", exitTimeMs: 4300 },
    { from: "blink_c", to: "blink_d", exitTimeMs: 1700 },
    { from: "blink_d", to: "blink_a", exitTimeMs: 5400 },
    { from: "blink_now", to: "blink_c", exitTimeMs: 360 },
    ...["blink_a", "blink_b", "blink_c", "blink_d"].map((s) => ({ from: s, to: "blink_now", conditions: [fire("blink")] })),
  ],
};

const ACTIONS = { wave: 110 / FPS, hop: 80 / FPS, cheer: 80 / FPS, cheer_stay: 80 / FPS, nod: 0.95 };
const layerAction = {
  name: "Action",
  states: [{ name: "act_rest", animation: "act_rest" }, { name: "cheer_loop", animation: "cheer_loop" },
    ...Object.keys(ACTIONS).map((n) => ({ name: n, animation: n }))],
  transitions: [{ from: "entry", to: "act_rest" }],
};
{
  const T = layerAction.transitions;
  const triggersFrom = (from, mix) => [
    // cheer swaps drawings only from the wave pose; head and celebrate poses hop in place
    { from, to: "cheer", conditions: [fire("cheer"), is("pose", 0)], durationMs: mix },
    { from, to: "cheer_stay", conditions: [fire("cheer")], durationMs: mix },
    { from, to: "hop", conditions: [fire("hop")], durationMs: mix },
    { from, to: "wave", conditions: [fire("wave")], durationMs: mix },
    { from, to: "nod", conditions: [fire("nod")], durationMs: mix },
  ];
  T.push(...triggersFrom("act_rest", 0));
  T.push({ from: "act_rest", to: "cheer_loop", conditions: [is("mood", 3)], durationMs: 150 });
  T.push(...triggersFrom("cheer_loop", 90));
  T.push({ from: "cheer_loop", to: "act_rest", conditions: [isnt("mood", 3)], durationMs: 300 });
  for (const [name, dur] of Object.entries(ACTIONS)) {
    T.push(...triggersFrom(name, 90));
    T.push({ from: name, to: "act_rest", exitTimeMs: Math.round(dur * 1000), durationMs: 60 });
  }
}

const layers = [layerPose, layerIdle, layerMood, layerBlink, layerAction];

// ---------------------------------------------------------------- write
const VM = "Coach";
const scene = {
  viewModels: [{ name: VM, properties: inputs.map((i) => ({ name: i.name, type: i.type })) }],
  viewModelInstances: [{ name: "Default", viewModel: VM, values: Object.fromEntries(inputs.map((i) => [i.name, 0])) }],
  artboard: { name: "Coach", ...ARTBOARD },
  viewModel: VM,
  groups,
  shapes,
  images,
  animations: anims,
  stateMachine: {
    name: "Coach",
    inputs,
    layers: layers.map((l) => ({
      name: l.name,
      states: l.states,
      transitions: l.transitions.map(({ conditions, ...t }) => (conditions?.length ? { ...t, condition: conditions[0] } : t)),
    })),
  },
};
writeFileSync(OUT_SCENE, JSON.stringify({ ...scene, stateMachine: { ...scene.stateMachine, layers } }, null, 1));

process.chdir(WEB);
const spec = JSON.parse(JSON.stringify(scene));
for (const img of spec.images) img.bytes = new Uint8Array(readFileSync(resolve(WEB, img.pngPath)));
const { objects, warnings } = buildScene(spec);
for (const w of warnings ?? []) console.warn("warn:", w);

// extra conditions: walk StateTransition objects in the writer's emission order
// (per layer: entry, any, then each state in order; transitions in array order).
{
  const order = [];
  for (const l of layers) {
    const froms = ["entry", "any", ...l.states.map((s) => s.name)];
    for (const from of froms) for (const t of l.transitions.filter((x) => x.from === from)) order.push(t);
  }
  const inputIndex = new Map(inputs.map((i, k) => [i.name, k]));
  const out = [];
  let ti = -1;
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i];
    out.push(o);
    if (o.type === "StateTransition") {
      ti++;
      const t = order[ti];
      const extra = (t.conditions ?? []).slice(1);
      if (extra.length) {
        // first condition object follows the transition; append the rest after it
        out.push(objects[++i]);
        for (const c of extra) {
          const k = inputIndex.get(c.input);
          const type = inputs[k].type;
          if (type === "trigger") out.push({ type: "TransitionTriggerCondition", props: { inputId: k } });
          else out.push({ type: "TransitionNumberCondition", props: { inputId: k, opValue: { "==": 0, "!=": 1, "<=": 2, ">=": 3, "<": 4, ">": 5 }[c.op ?? "=="], value: Number(c.value ?? 0) } });
        }
      }
    }
  }
  if (ti + 1 !== order.length) throw new Error(`transition count mismatch ${ti + 1} vs ${order.length}`);
  objects.length = 0;
  objects.push(...out);
}

const defs = loadDefs();
const fileOf = new Map(Object.entries(defs.types).map(([k, v]) => [v.file, k]));
const propKeyOf = (t, p) => {
  for (let c = t; c; c = defs.types[c].extends ? fileOf.get(defs.types[c].extends) : null) {
    if (defs.types[c].properties[p]) return defs.types[c].properties[p].key;
  }
  throw new Error(`${t}.${p}`);
};
const bound = bindConditions(objects, {
  vmIndex: 0,
  propIndex: new Map(inputs.map((i, k) => [i.name, k])),
  propKeyOf,
  encodeIds: encodeVaruintList,
});
writeFileSync(OUT_RIV, writeRiv(bound));

// layout contract for the app: artboard size and where each pose's drawing sits on it
const rect = (p, x, y, w, h) => ({ x: OFFSET[p][0] + x, y: OFFSET[p][1] + y, w, h });
const layout = {
  artboard: ARTBOARD,
  rects: {
    wave: rect("w", 0, 0, rig.wave.width, rig.wave.height),
    celebrate: rect("c", 0, 0, rig.celebrate.width, rig.celebrate.height),
    // same crop as the sprite rig's head pose (wave drawing, face only)
    head: rect("w", 40, 22, 612, 618),
  },
};
writeFileSync(
  OUT_TS,
  `// Generated by apps/web/scripts/mascot-coach-build.mjs. Do not edit by hand.
/* eslint-disable */
export const COACH = ${JSON.stringify(layout, null, 2).replace(/"(\w+)":/g, "$1:")} as const;

/** View model "Coach" bound to state machine "Coach" (see DESIGN.md, Mascot). */
export const COACH_VM = {
  pose: { wave: 0, celebrate: 1, head: 2 },
  mood: { idle: 0, listening: 1, thinking: 2, cheer: 3 },
  still: { off: 0, on: 1 },
  triggers: ${JSON.stringify(TRIGGERS)},
} as const;
`,
);
console.log(`wrote ${OUT_RIV} (${(statSync(OUT_RIV).size / 1024).toFixed(1)} KB), ${anims.length} animations, ${layers.length} layers`);
