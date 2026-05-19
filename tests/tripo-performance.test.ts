import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTripoOptions } from "../server/providers/tripoModel.js";

describe("Tripo performance options", () => {
  it("defaults to skipping the intermediate GLB download before STL conversion", () => {
    const options = getTripoOptions({});

    assert.equal(options.downloadIntermediateGlb, false);
  });

  it("allows poll interval tuning from environment", () => {
    const options = getTripoOptions({ TRIPO_POLL_INTERVAL_MS: "1500" });

    assert.equal(options.pollIntervalMs, 1500);
  });
});
