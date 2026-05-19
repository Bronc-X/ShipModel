import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateInput } from "../server/validation.js";
import type { ModelRequest } from "../server/types.js";

const validInput: ModelRequest = {
  category: "aircraft",
  subtype: "jet",
  style: "真实比例",
  primaryColor: "#f3ead7",
  accentColor: "#2e3538",
  label: "",
  markingText: "",
  description: "调整参数后重新生成概念图。",
  targetLengthMm: 250
};

describe("validateInput", () => {
  it("accepts a 250 mm target length for regenerated concept images", () => {
    assert.deepEqual(validateInput(validInput), []);
  });

  it("returns a target length reason only outside the supported range", () => {
    assert.deepEqual(validateInput({ ...validInput, targetLengthMm: 301 }), ["target_length_out_of_range"]);
  });
});
