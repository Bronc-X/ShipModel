import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendHistoryEntry, getHistoryEntries, lastProjectStorageKey, type LocalHistoryStore } from "../src/toybox/localHistory";
import type { Concept, ModelRequest } from "../src/types";

const input: ModelRequest = {
  category: "aircraft",
  subtype: "jet",
  style: "真实比例",
  primaryColor: "#f3ead7",
  accentColor: "#2e3538",
  label: "A01",
  markingText: "TONI A01",
  description: "生成一个可打印的现代战机模型。",
  targetLengthMm: 180
};

const concepts: Concept[] = [
  {
    id: "concept-a",
    title: "建模图",
    imageUrl: "data:image/png;base64,iVBORw0KGgo=",
    prompt: "prompt-a",
    feedback: "主体完整。"
  }
];

class MemoryStore implements LocalHistoryStore {
  protected data = new Map<string, string>();

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

class QuotaStore extends MemoryStore {
  constructor(private readonly maxValueLength: number) {
    super();
  }

  setItem(key: string, value: string) {
    if (value.length > this.maxValueLength) {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    }
    super.setItem(key, value);
  }
}

describe("toybox local history", () => {
  it("appends each generated run instead of replacing the previous record", () => {
    const store = new MemoryStore();

    appendHistoryEntry(store, { input, runId: "run-1", concepts, status: "concept" }, "2026-05-12T08:00:00.000Z");
    appendHistoryEntry(store, { input: { ...input, label: "A02", markingText: "TONI A02" }, runId: "run-2", concepts, status: "concept" }, "2026-05-12T08:01:00.000Z");

    const entries = getHistoryEntries(store);
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((entry) => entry.runId), ["run-2", "run-1"]);
    assert.equal(entries[0].label, "TONI A02");
  });

  it("falls back to an unmarked label when no model marking is provided", () => {
    const store = new MemoryStore();

    appendHistoryEntry(store, { input: { ...input, markingText: "" }, runId: "run-unmarked", concepts, status: "concept" }, "2026-05-12T08:00:00.000Z");

    const entries = getHistoryEntries(store);
    assert.equal(entries[0].label, "未加标志");
  });

  it("updates an existing run when the STL status changes", () => {
    const store = new MemoryStore();

    appendHistoryEntry(store, { input, runId: "run-1", concepts, status: "concept" }, "2026-05-12T08:00:00.000Z");
    appendHistoryEntry(
      store,
      { input, runId: "run-1", concepts, selectedConceptId: "concept-a", status: "ready" },
      "2026-05-12T08:02:00.000Z"
    );

    const entries = getHistoryEntries(store);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].status, "ready");
    assert.equal(entries[0].selectedConceptId, "concept-a");
    assert.equal(entries[0].updatedAt, "2026-05-12T08:02:00.000Z");
  });

  it("stores lightweight snapshots when concept images are large data URLs", () => {
    const store = new MemoryStore();
    const largeConcepts: Concept[] = [
      {
        ...concepts[0],
        imageUrl: `data:image/png;base64,${"A".repeat(50_000)}`,
        prompt: "x".repeat(10_000)
      }
    ];

    appendHistoryEntry(store, { input, runId: "run-large", concepts: largeConcepts, status: "concept" }, "2026-05-12T08:03:00.000Z");

    const entries = getHistoryEntries(store);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].concepts[0].imageUrl, "");
    assert.equal(entries[0].concepts[0].prompt, "");

    const lastProject = JSON.parse(store.getItem(lastProjectStorageKey) ?? "{}") as { concepts?: unknown[]; previewImageUrl?: string | null };
    assert.deepEqual(lastProject.concepts, []);
    assert.equal(lastProject.previewImageUrl, null);
  });

  it("does not throw when storage quota is exceeded", () => {
    const store = new QuotaStore(900);
    const largeConcepts: Concept[] = [
      {
        ...concepts[0],
        imageUrl: `data:image/png;base64,${"A".repeat(50_000)}`
      }
    ];

    assert.doesNotThrow(() => {
      appendHistoryEntry(store, { input, runId: "run-quota", concepts: largeConcepts, status: "concept" }, "2026-05-12T08:04:00.000Z");
    });
  });
});
