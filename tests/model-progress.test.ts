import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getModelBuildMockState } from "../src/toybox/modelBuildProgress.ts";

describe("model build mock progress", () => {
  it("moves monotonically through a 90-120 second window without looping", () => {
    const samples = [0, 15_000, 30_000, 60_000, 90_000, 105_000, 120_000, 150_000].map((elapsedMs) =>
      getModelBuildMockState(elapsedMs, true).progress
    );

    assert.equal(samples[0], 8);
    assert.ok(samples[4] - samples[3] > samples[2] - samples[0], "later progress should move faster than early progress");
    for (let index = 1; index < samples.length; index += 1) {
      assert.ok(samples[index] >= samples[index - 1], `progress moved backward at sample ${index}`);
    }
    assert.equal(samples.at(-1), 96);
  });

  it("returns a completed state when model generation is no longer busy", () => {
    const complete = getModelBuildMockState(12_000, false);

    assert.equal(complete.progress, 100);
    assert.equal(complete.logIndex, 14);
  });
});
