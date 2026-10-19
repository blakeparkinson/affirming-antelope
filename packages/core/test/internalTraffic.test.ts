import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { internalParam, isInternalTraffic } from "../src/analytics";

const prod = "app.affirmingantelope.com";
const base = { dev: false, web: false, productionHost: prod, onDevice: true, stored: false };

describe("isInternalTraffic", () => {
  it("is false for a real learner on a phone", () => {
    assert.equal(isInternalTraffic(base), false);
  });

  it("is false for a real learner on the production web app", () => {
    assert.equal(isInternalTraffic({ ...base, web: true, host: prod }), false);
  });

  it("marks development builds, wherever they run", () => {
    assert.equal(isInternalTraffic({ ...base, dev: true }), true);
    assert.equal(isInternalTraffic({ ...base, dev: true, web: true, host: prod }), true);
  });

  it("marks simulators and emulators", () => {
    assert.equal(isInternalTraffic({ ...base, onDevice: false }), true);
  });

  it("marks any other web host: Vercel previews, localhost, a missing host", () => {
    assert.equal(isInternalTraffic({ ...base, web: true, host: "affirming-antelope-app-git-x.vercel.app" }), true);
    assert.equal(isInternalTraffic({ ...base, web: true, host: "localhost:8081" }), true);
    assert.equal(isInternalTraffic({ ...base, web: true }), true);
  });

  it("treats a lookalike host as internal, not production", () => {
    assert.equal(isInternalTraffic({ ...base, web: true, host: `${prod}.evil.example` }), true);
    assert.equal(isInternalTraffic({ ...base, web: true, host: `staging.${prod}` }), true);
  });

  it("ignores onDevice on the web (a browser is never a simulator)", () => {
    assert.equal(isInternalTraffic({ ...base, web: true, host: prod, onDevice: false }), false);
  });

  it("marks a device someone on the team opted in", () => {
    assert.equal(isInternalTraffic({ ...base, stored: true }), true);
    assert.equal(isInternalTraffic({ ...base, web: true, host: prod, stored: true }), true);
  });
});

describe("internalParam", () => {
  it("accepts only 1 and 0", () => {
    assert.equal(internalParam("1"), "1");
    assert.equal(internalParam("0"), "0");
  });

  it("ignores anything else: missing, empty, arrays, other words", () => {
    for (const raw of [undefined, null, "", "true", "yes", "01", ["1"], 1]) assert.equal(internalParam(raw), undefined);
  });
});
