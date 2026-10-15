#!/usr/bin/env node
// Builds the Path landmarks: one .riv per landmark (vector art + a looping "idle" state
// machine) and a still PNG of each for web, where Rive doesn't run.
//
//   node apps/mobile/scripts/landmarks/build.mjs            # all landmarks
//   node apps/mobile/scripts/landmarks/build.mjs baobab     # just one
//   ... --preview                                           # also render 3 frames per landmark
//
// The art lives in art.mjs as SVG path data in the mascot's style (flat fills, one shade,
// cream highlights, a thick ink outline). It goes through rive-mcp-server's scene writer, the
// same one the mascot build uses (apps/web/scripts/mascot-coach-build.mjs); run
// `npx -y rive-mcp-server` once so it's in the npx cache.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INK, LANDMARKS } from "./art.mjs";
import { toRive } from "./svgpath.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(HERE, "../..");
const OUT_RIV = resolve(MOBILE, "assets/rive/landmarks");
const OUT_PNG = resolve(MOBILE, "assets/images/landmarks");
const OUT_TS = resolve(MOBILE, "src/components/path/landmarks.generated.ts");
const PREVIEW = resolve(MOBILE, "scripts/landmarks/preview");
const FPS = 60;
export const STATE_MACHINE = "Idle";

function serverDist() {
  const root = join(homedir(), ".npm/_npx");
  for (const d of readdirSync(root)) {
    const p = join(root, d, "node_modules/rive-mcp-server/dist");
    if (existsSync(join(p, "rivWriter.js"))) return p;
  }
  throw new Error("rive-mcp-server not in the npx cache; run `npx -y rive-mcp-server` once");
}
const { buildScene, writeRiv } = await import(join(serverDist(), "rivWriter.js"));

/** Scene spec for one landmark. */
function sceneOf(id, L) {
  // `pad` adds room around the drawing (art keeps its coordinates; the artboard grows)
  const [pl, pt, pr, pb] = L.pad ?? [0, 0, 0, 0];
  const W = L.size[0] + pl + pr;
  const H = L.size[1] + pt + pb;
  const groups = [];
  const abs = new Map([["root", [0, 0]]]); // art units, before padding
  groups.push({ id: "root", x: pl, y: pt });
  for (const g of L.groups ?? []) {
    const parent = g.parent ?? "root";
    const p = abs.get(parent);
    if (!p) throw new Error(`${id}: group ${g.id} has unknown parent ${parent}`);
    groups.push({ id: g.id, parent, x: g.at[0] - p[0], y: g.at[1] - p[1] });
    abs.set(g.id, g.at);
  }
  const shapes = [];
  let n = 0;
  const shape = (group, d, paint, extra = {}) => {
    const [gx, gy] = abs.get(group ?? "root") ?? (() => { throw new Error(`${id}: unknown group ${group}`); })();
    const sid = extra.id ?? `${id}_${n++}`;
    shapes.push({ id: sid, type: "polygon", parent: group ?? "root", x: 0, y: 0, subpaths: toRive(d, gx, gy), ...paint, ...extra, ...(extra.id ? {} : {}) });
    return sid;
  };
  const ink = (w) => ({ thickness: w, color: INK, cap: "round", join: "round" });

  for (const part of L.parts) {
    const g = part.group;
    if (part.line) {
      // an open ink line (a crease, a twig): no fill
      shape(g, part.line, { stroke: ink(part.width ?? 5) });
      continue;
    }
    if (part.flat) {
      // a plain fill with no outline (ground shadow, water glint)
      shape(g, part.flat, { fill: { color: part.color }, ...(part.opacity !== undefined ? { opacity: part.opacity } : {}) });
      continue;
    }
    // a piece: fill, then shade/highlight blobs clipped to it, then its outline on top
    const base = shape(g, part.d, { fill: { color: part.fill } });
    for (const s of part.shades ?? []) shape(g, s.d, { fill: { color: s.color }, clipBy: base });
    if (part.outline !== false) shape(g, part.d, { stroke: ink(part.width ?? 7) });
    for (const l of part.lines ?? []) shape(g, l, { stroke: ink(part.lineWidth ?? 4.5) });
  }

  // animation: tracks in seconds; x/y are offsets from the group's rest position
  const anim = L.anim;
  const frames = Math.round(anim.duration * FPS);
  const tracks = anim.tracks.map((t) => {
    const g = groups.find((x) => x.id === t.target);
    if (!g) throw new Error(`${id}: anim target ${t.target} is not a group`);
    const prop = t.property;
    const base = prop === "x" ? g.x : prop === "y" ? g.y : prop === "scaleX" || prop === "scaleY" || prop === "opacity" ? 0 : 0;
    return {
      target: t.target,
      property: prop,
      keyframes: t.keys.map(([s, v], i) => ({
        frame: Math.min(frames, Math.round(s * FPS)),
        value: base + v,
        ...(i ? { easing: t.easing ?? "ease-in-out" } : {}),
      })),
    };
  });
  return {
    artboard: { name: id, width: W, height: H },
    backgroundColor: "#00000000",
    groups,
    shapes,
    animations: [{ name: "idle", fps: FPS, duration: frames, loop: "loop", tracks }],
    stateMachine: {
      name: STATE_MACHINE,
      inputs: [],
      layers: [{ name: "Idle", states: [{ name: "idle", animation: "idle" }], transitions: [{ from: "entry", to: "idle" }] }],
    },
  };
}

// ---------------------------------------------------------------- MCP client (for renders)
function mcp() {
  const child = spawn("npx", ["-y", "rive-mcp-server"], { stdio: ["pipe", "pipe", "pipe"], env: process.env });
  let buf = "";
  let next = 1;
  const pending = new Map();
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const p = msg.id != null && pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  });
  const call = (method, params) =>
    new Promise((res, rej) => {
      const id = next++;
      pending.set(id, { resolve: res, reject: rej });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  return {
    async init() {
      await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "landmarks", version: "1" } });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
    },
    async tool(name, args) {
      const r = await call("tools/call", { name, arguments: args });
      if (r.isError) throw new Error(r.content?.map((c) => c.text).join("\n"));
      return r;
    },
    close: () => child.kill(),
  };
}

// ---------------------------------------------------------------- main
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const preview = process.argv.includes("--preview");
mkdirSync(OUT_RIV, { recursive: true });
mkdirSync(OUT_PNG, { recursive: true });
if (preview) mkdirSync(PREVIEW, { recursive: true });

const ids = Object.keys(LANDMARKS).filter((k) => !only.length || only.includes(k));
const client = mcp();
await client.init();
try {
  for (const id of ids) {
    const L = LANDMARKS[id];
    const { objects, warnings } = buildScene(sceneOf(id, L));
    for (const w of warnings ?? []) console.warn(`${id} warn:`, w);
    const riv = join(OUT_RIV, `${id}.riv`);
    writeFileSync(riv, writeRiv(objects));
    // the web still: the rest pose, 3x the on-screen width
    await client.tool("riv_render_frame", { path: riv, animation: "idle", time: 0, width: Math.round((L.size[0] + (L.pad?.[0] ?? 0) + (L.pad?.[2] ?? 0)) * 1.2), outPath: join(OUT_PNG, `${id}.png`) });
    if (preview) {
      for (const t of [0, L.anim.duration * 0.25, L.anim.duration * 0.5]) {
        await client.tool("riv_render_frame", {
          path: riv, animation: "idle", time: t, width: 600, background: L.previewBg ?? "#EEF1FF",
          outPath: join(PREVIEW, `${id}-${t.toFixed(2)}.png`),
        });
      }
    }
    console.log(`${id}: ${(statSync(riv).size / 1024).toFixed(1)} KB`);
  }
} finally {
  client.close();
}

// sizes and anchors for the app (art units; the app scales to its own width)
writeFileSync(
  OUT_TS,
  `// Generated by apps/mobile/scripts/landmarks/build.mjs. Do not edit by hand.
/* eslint-disable */
export const LANDMARK_ART = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(LANDMARKS).map(([k, L]) => {
        const [pl, pt, pr, pb] = L.pad ?? [0, 0, 0, 0];
        return [k, { width: L.size[0] + pl + pr, height: L.size[1] + pt + pb, ground: L.ground + pt, peek: L.peek ?? 0.3 }];
      }),
    ),
    null,
    2,
  ).replace(/"(\w+)":/g, "$1:")} as const;

export type LandmarkId = keyof typeof LANDMARK_ART;
export const LANDMARK_STATE_MACHINE = ${JSON.stringify(STATE_MACHINE)};
`,
);
