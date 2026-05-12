import type { Concept, ConceptProgressEvent, HandshakeResponse, ModelRequest, ModelRun } from "./types";

export async function getHandshake() {
  const response = await fetch("/api/handshake");

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as HandshakeResponse;
}

export async function generateConcepts(input: ModelRequest, onProgress?: (event: ConceptProgressEvent) => void) {
  const response = await fetch("/api/concepts", {
    method: "POST",
    headers: {
      "Accept": onProgress ? "application/x-ndjson" : "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (onProgress) {
    return readConceptProgress(response, onProgress);
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as { runId: string; concepts: Concept[] };
}

async function readConceptProgress(response: Response, onProgress: (event: ConceptProgressEvent) => void) {
  if (!response.ok || !response.body) {
    throw new Error(await getErrorMessage(response));
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let result: { runId: string; concepts: Concept[] } | null = null;
  let lastMessage = "Concept generation failed";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ConceptProgressEvent;
      lastMessage = event.message || lastMessage;
      onProgress(event);

      if (event.response) {
        result = event.response;
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as ConceptProgressEvent;
    lastMessage = event.message || lastMessage;
    onProgress(event);
    if (event.response) {
      result = event.response;
    }
  }

  if (!result) {
    throw new Error(lastMessage);
  }

  return result;
}

export async function generateModel(runId: string, conceptId: string) {
  const response = await fetch("/api/models", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ runId, conceptId })
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as { run: ModelRun };
}

export async function getRun(runId: string) {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as { run: ModelRun };
}

async function getErrorMessage(response: Response) {
  try {
    const json = (await response.json()) as { message?: string; error?: string; reasons?: string[] };
    return json.message ?? formatReasons(json.reasons) ?? json.error ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

function formatReasons(reasons?: string[]) {
  if (!reasons?.length) return null;

  const messages: Record<string, string> = {
    target_length_out_of_range: "外接盒 X 轴尺寸需在 60-300 mm 内。"
  };

  return reasons.map((reason) => messages[reason] ?? reason).join("；");
}
