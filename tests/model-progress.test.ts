import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildModelTimeline, getPipelineState, summarizeModelFailure } from "../src/toybox/modelJobProgress.ts";
import type { ModelJobEvent } from "../src/types.ts";

const jobId = "event-progress-run";

describe("model build event progress", () => {
  it("builds progress from real job and tool events", () => {
    const events: ModelJobEvent[] = [
      { type: "job.started", jobId, title: "生成 STL 模型", at: "2026-05-18T00:00:00.000Z" },
      { type: "tool.started", jobId, callId: "tripo_generate_model", name: "tripo_image_to_model", inputSummary: "建模图", at: "2026-05-18T00:00:01.000Z" },
      { type: "tool.completed", jobId, callId: "tripo_generate_model", name: "tripo_image_to_model", outputSummary: "model.stl", at: "2026-05-18T00:00:02.000Z" },
      { type: "artifact.created", jobId, artifactId: `${jobId}:stl`, kind: "stl", title: "可下载 STL 文件", data: { href: "/runs/event-progress-run/model.stl" }, at: "2026-05-18T00:00:03.000Z" }
    ];

    const timeline = buildModelTimeline(events, true);

    assert.ok(timeline.some((item) => item.tag === "TRIPO-IMAGE-TO-MODEL" && item.state === "active"));
    assert.ok(timeline.some((item) => item.tag === "TRIPO-IMAGE-TO-MODEL" && item.state === "done"));
    assert.ok(timeline.some((item) => item.tag === "ARTIFACT" && item.message === "可下载 STL 文件"));
  });

  it("marks pipeline stages from matching event keys", () => {
    const events: ModelJobEvent[] = [
      { type: "tool.started", jobId, callId: "validate_stl", name: "validate_stl", inputSummary: "model.stl", at: "2026-05-18T00:00:01.000Z" },
      { type: "tool.completed", jobId, callId: "validate_stl", name: "validate_stl", outputSummary: "STL 文件通过基础校验", at: "2026-05-18T00:00:02.000Z" }
    ];

    assert.equal(getPipelineState(events, ["validate_stl"], true, 2), "done");
    assert.equal(getPipelineState([], ["tripo_generate_model"], true, 0), "active");
    assert.equal(getPipelineState([], ["tripo_generate_model"], true, 1), "pending");
  });

  it("does not label failed completed jobs as successful generation", () => {
    const events: ModelJobEvent[] = [
      { type: "step.failed", jobId, stepId: "model_generation", error: "TRIPO_API_KEY is missing", recoverable: true, at: "2026-05-18T00:00:01.000Z" },
      {
        type: "job.completed",
        jobId,
        at: "2026-05-18T00:00:02.000Z",
        response: {
          run: {
            runId: jobId,
            input: {
              category: "aircraft",
              subtype: "airliner",
              style: "航展涂装",
              primaryColor: "#245b70",
              accentColor: "#f3ead7",
              label: "",
              markingText: "TONI ASIA",
              description: "失败流测试。",
              targetLengthMm: 120
            },
            concepts: [],
            status: "Failed",
            reasons: ["TRIPO_API_KEY is missing"],
            files: {},
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:02.000Z"
          }
        }
      }
    ];

    const timeline = buildModelTimeline(events, false);

    assert.ok(timeline.some((item) => item.message === "模型生成失败" && item.state === "error"));
    assert.equal(timeline.some((item) => item.message === "模型生成完成"), false);
  });

  it("classifies Tripo upload connection timeout as a network issue", () => {
    const summary = summarizeModelFailure([
      "Tripo image upload failed before response: fetch failed - UND_ERR_CONNECT_TIMEOUT - Connect Timeout Error (attempted address: api.tripo3d.ai:443, timeout: 10000ms)"
    ]);

    assert.equal(summary.title, "Tripo 上传连接超时");
    assert.equal(summary.action, "先检查 WARP/VPN、DNS 或代理，再重试生成。");
  });

  it("shows a loading failure summary while a failed run is being restored", () => {
    const summary = summarizeModelFailure([]);

    assert.equal(summary.title, "正在读取失败原因");
    assert.equal(summary.action, "正在从本地 API 恢复这次生成记录，请稍等。");
  });
});
