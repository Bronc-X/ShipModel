import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Concept, ModelRequest } from "../server/types.js";
import { openAiConcepts, reviseOpenAiConcept } from "../server/providers/openaiImages.js";

const input: ModelRequest = {
  category: "aircraft",
  subtype: "airliner",
  style: "航展涂装",
  primaryColor: "#2e3538",
  accentColor: "#2e3538",
  label: "",
  markingText: "",
  description: "大型双发客机，干净机身。",
  targetLengthMm: 120
};

const imageResponse = {
  data: [{ b64_json: "iVBORw0KGgo=" }]
};

describe("OpenAI concept image policy", () => {
  it("generates only one concept image", async () => {
    const calls: unknown[] = [];
    const fetchMock = async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return jsonResponse(imageResponse);
    };

    const concepts = await withImageEnv(() => openAiConcepts(input, "single-image-run", {}, fetchMock));

    assert.equal(calls.length, 1);
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0].title, "建模图");
  });

  it("revises an existing concept from natural language instructions", async () => {
    const concept: Concept = {
      id: "concept-a",
      title: "建模图",
      imageUrl: "data:image/png;base64,iVBORw0KGgo=",
      prompt: "original prompt",
      feedback: "original"
    };
    const calls: Array<{ url: string; body: RequestInit["body"] }> = [];
    const fetchMock = async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body });
      return jsonResponse(imageResponse);
    };

    const revised = await withImageEnv(() => reviseOpenAiConcept(input, concept, "把机颈再往上调 8 到 10 度，颜色改成绿色。", fetchMock));

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/images\/edits$/);
    assert.ok(calls[0].body instanceof FormData);
    assert.match(String(calls[0].body.get("prompt")), /8 到 10 度/);
    assert.match(String(calls[0].body.get("prompt")), /绿色/);
    assert.match(String(calls[0].body.get("prompt")), /Preserve the same camera angle/);
    assert.match(String(calls[0].body.get("prompt")), /Do not redesign unrelated areas/);
    assert.ok(calls[0].body.get("image") instanceof Blob);
    assert.equal(revised.title, "修改后的建模图");
    assert.notEqual(revised.id, concept.id);
  });

  it("downloads URL concepts before sending them to the image edit endpoint", async () => {
    const concept: Concept = {
      id: "concept-url",
      title: "建模图",
      imageUrl: "https://example.test/concept.png",
      prompt: "original prompt"
    };
    const calls: string[] = [];
    const fetchMock = async (url: string, init: RequestInit) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      if (url === concept.imageUrl) {
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { "Content-Type": "image/png" }
        });
      }
      return jsonResponse(imageResponse);
    };

    const revised = await withImageEnv(() => reviseOpenAiConcept(input, concept, "把船锚展示出来。", fetchMock));

    assert.deepEqual(calls, [
      "GET https://example.test/concept.png",
      "POST https://api.openai.com/v1/images/edits"
    ]);
    assert.equal(revised.title, "修改后的建模图");
  });
});

async function withImageEnv<T>(task: () => Promise<T>) {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  try {
    return await task();
  } finally {
    process.env.OPENAI_API_KEY = previousKey;
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
