import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ModelRequest } from "../server/types.js";
import { buildImagePrompt } from "../server/providers/prompt.js";

const baseInput: ModelRequest = {
  category: "aircraft",
  subtype: "space-fighter",
  style: "未来实验室",
  primaryColor: "#245b70",
  accentColor: "#f3ead7",
  label: "07",
  markingText: "",
  description: "真实世界无人机比例，干净的机身和长翼展。",
  targetLengthMm: 120
};

describe("image prompt policy", () => {
  it("uses realistic reference shapes instead of cartoon toy language", () => {
    const prompt = buildImagePrompt(baseInput, "A");

    assert.match(prompt, /real-world/i);
    assert.match(prompt, /unmanned|UAV|drone/i);
    assert.match(prompt, /Avoid cartoon style, chibi proportions/i);
    assert.doesNotMatch(prompt, /toy-like|space fighter toy/i);
  });

  it("keeps naval prompts realistic without emphasizing weapons", () => {
    const prompt = buildImagePrompt(
      {
        ...baseInput,
        category: "ship",
        subtype: "warship",
        style: "海事经典",
        description: "现代舰艇外形，适合静态展示。"
      },
      "B"
    );

    assert.match(prompt, /destroyer|frigate|naval/i);
    assert.match(prompt, /understated/i);
    assert.doesNotMatch(prompt, /stylized warship|weapon emphasis/i);
  });

  it("passes selected dimensions, style, and colors into render prompts without the removed number field", () => {
    const prompt = buildImagePrompt(
      {
        ...baseInput,
        category: "vehicle",
        subtype: "race-car",
        style: "复古套件",
        primaryColor: "#e5b843",
        accentColor: "#2e3538",
        label: "07",
        targetLengthMm: 120
      },
      "A"
    );

    assert.match(prompt, /120 x 55 x 38 mm/i);
    assert.match(prompt, /复古套件|vintage kit/i);
    assert.match(prompt, /#e5b843|rescue yellow/i);
    assert.match(prompt, /#2e3538|graphite black/i);
    assert.doesNotMatch(prompt, /exact number "07"/i);
    assert.match(prompt, /racing car|track-day body kit/i);
  });

  it("uses optional model marking text instead of the old number field", () => {
    const prompt = buildImagePrompt(
      {
        ...baseInput,
        label: "07",
        markingText: "TONI ASIA"
      },
      "A"
    );

    assert.match(prompt, /TONI ASIA/);
    assert.match(prompt, /raised simple marking/i);
    assert.doesNotMatch(prompt, /exact number "07"/i);
  });

  it("treats user geometry requests as mandatory overrides while keeping printability constraints", () => {
    const prompt = buildImagePrompt(
      {
        ...baseInput,
        category: "vehicle",
        subtype: "race-car",
        description: "跑车做成大脚车，40寸轮毂，高底盘，夸张轮拱。"
      },
      "A"
    );

    assert.match(prompt, /Mandatory user geometry requirements/i);
    assert.match(prompt, /override subtype defaults/i);
    assert.match(prompt, /大脚车/);
    assert.match(prompt, /monster-truck conversion/i);
    assert.match(prompt, /oversized 40-inch wheels/i);
    assert.match(prompt, /lifted suspension/i);
    assert.match(prompt, /enlarged wheel arches/i);
    assert.match(prompt, /single connected printable/i);
    assert.match(prompt, /no thin floating suspension rods/i);
  });

  it("builds realistic passenger airliner prompts with printable details", () => {
    const prompt = buildImagePrompt(
      {
        ...baseInput,
        subtype: "airliner",
        description: "大型双发客机，干净机身，清晰舷窗。"
      },
      "B"
    );

    assert.match(prompt, /passenger airliner|commercial jet/i);
    assert.match(prompt, /cylindrical fuselage/i);
    assert.match(prompt, /wing-mounted engines/i);
    assert.match(prompt, /window rows/i);
    assert.match(prompt, /thicken wings, landing gear, engine nacelles/i);
    assert.doesNotMatch(prompt, /fighter|weapon/i);
  });
});
