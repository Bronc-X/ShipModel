import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateTripoModel, getTripoOptions, resolveTripoProxyUrl, shouldRetryTripoNetworkError, withTripoNetworkRetry } from "../server/providers/tripoModel.js";
import type { ModelRun } from "../server/types.js";

describe("Tripo performance options", () => {
  it("defaults to skipping the intermediate GLB download before STL conversion", () => {
    const options = getTripoOptions({});

    assert.equal(options.downloadIntermediateGlb, false);
  });

  it("allows poll interval tuning from environment", () => {
    const options = getTripoOptions({ TRIPO_POLL_INTERVAL_MS: "1500" });

    assert.equal(options.pollIntervalMs, 1500);
  });

  it("defaults to faster polling and disables UV export for STL-only output", () => {
    const options = getTripoOptions({});

    assert.equal(options.pollIntervalMs, 2000);
    assert.equal(options.networkRetries, 3);
    assert.equal(options.retryDelayMs, 1000);
    assert.equal(options.exportUv, false);
    assert.equal(options.texture, false);
    assert.equal(options.pbr, false);
  });

  it("retries transient Tripo network failures before surfacing the timeout", async () => {
    let attempts = 0;

    const result = await withTripoNetworkRetry(
      "Tripo image upload",
      {
        networkRetries: 3,
        retryDelayMs: 0
      },
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("fetch failed - UND_ERR_CONNECT_TIMEOUT - Connect Timeout Error");
        }
        return "file-token";
      }
    );

    assert.equal(result, "file-token");
    assert.equal(attempts, 3);
  });

  it("keeps the final Tripo timeout specific after all retries fail", async () => {
    await assert.rejects(
      () =>
        withTripoNetworkRetry(
          "Tripo image upload",
          {
            networkRetries: 3,
            retryDelayMs: 0
          },
          async () => {
            throw new Error("fetch failed - UND_ERR_CONNECT_TIMEOUT - Connect Timeout Error");
          }
        ),
      /Tripo image upload failed after 3 attempts: fetch failed - UND_ERR_CONNECT_TIMEOUT/
    );
  });

  it("only retries network and timeout style Tripo errors", () => {
    assert.equal(shouldRetryTripoNetworkError(new Error("fetch failed - UND_ERR_CONNECT_TIMEOUT - Connect Timeout Error")), true);
    assert.equal(shouldRetryTripoNetworkError(new Error("getaddrinfo ENOTFOUND api.tripo3d.ai")), true);
    assert.equal(shouldRetryTripoNetworkError(new Error("Tripo API error: One or more of your parameter is invalid")), false);
  });

  it("does not inherit generic system proxy settings for Tripo unless explicitly enabled", () => {
    assert.equal(resolveTripoProxyUrl({ HTTPS_PROXY: "http://127.0.0.1:7890" }), undefined);
    assert.equal(resolveTripoProxyUrl({ TRIPO_PROXY_URL: "http://127.0.0.1:7890" }), "http://127.0.0.1:7890");
    assert.equal(resolveTripoProxyUrl({ TRIPO_USE_SYSTEM_PROXY: "true", HTTPS_PROXY: "http://127.0.0.1:7890" }), "http://127.0.0.1:7890");
  });

  it("can switch to the Tripo turbo model version without code changes", () => {
    const options = getTripoOptions({
      TRIPO_MODEL_VERSION: "Turbo-v1.0-20250506",
      TRIPO_EXPORT_UV: "false"
    });

    assert.equal(options.modelVersion, "Turbo-v1.0-20250506");
    assert.equal(options.exportUv, false);
  });

  it("rejects incomplete concept images before calling Tripo upload", async () => {
    const previousKey = process.env.TRIPO_API_KEY;
    process.env.TRIPO_API_KEY = "test-key";
    const run: ModelRun = {
      runId: "invalid-image-run",
      input: {
        category: "vehicle",
        subtype: "race-car",
        style: "track",
        primaryColor: "#050505",
        accentColor: "#050505",
        label: "",
        markingText: "",
        description: "test",
        targetLengthMm: 120
      },
      concepts: [
        {
          id: "concept-a",
          title: "建模图",
          imageUrl: "data:image/png;base64,iVBORw0KGgo=",
          prompt: "test"
        }
      ],
      selectedConceptId: "concept-a",
      reasons: [],
      files: {},
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z"
    };

    try {
      await assert.rejects(() => generateTripoModel(run), /概念图数据不完整/);
    } finally {
      process.env.TRIPO_API_KEY = previousKey;
    }
  });
});
