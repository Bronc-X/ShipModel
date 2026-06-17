import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { persistConceptImages } from "../server/storage";
import type { Concept } from "../server/types";

describe("concept image persistence", () => {
  it("turns generated data images into reusable run file URLs", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "toybox-runs-"));
    const runId = "history-preview-run";
    const concepts: Concept[] = [
      {
        id: "concept-a",
        title: "建模图",
        imageUrl: "data:image/png;base64,aGVsbG8=",
        prompt: "prompt"
      }
    ];

    try {
      const persisted = await persistConceptImages(runId, concepts, tempRoot);

      assert.equal(persisted[0].imageUrl, `/runs/${runId}/concept-1.png`);
      assert.equal(persisted[0].imageDataUrl, concepts[0].imageUrl);
      assert.equal(await readFile(path.join(tempRoot, runId, "concept-1.png"), "utf8"), "hello");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});
