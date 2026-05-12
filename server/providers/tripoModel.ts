import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fetch as undiciFetch, FormData, ProxyAgent, type Dispatcher } from "undici";
import type { ModelRun } from "../types.js";
import { getRunDir } from "../storage.js";

interface TripoEnvelope<T> {
  code?: number;
  data?: T;
  message?: string;
  suggestion?: string;
}

interface TripoTaskResponse {
  task_id?: string;
  taskId?: string;
  id?: string;
}

interface TripoTaskStatus {
  task_id?: string;
  status?: string;
  output?: {
    model?: string;
    base_model?: string;
    pbr_model?: string;
  };
  error_msg?: string;
  message?: string;
}

type TripoImageInput = {
  type: "jpg";
  url?: string;
  file_token?: string;
};

const defaultBaseUrl = "https://api.tripo3d.ai/v2/openapi";
const pollIntervalMs = 5000;
const pollTimeoutMs = 1000 * 60 * 10;
const tripoProxyUrl = process.env.TRIPO_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const tripoDispatcher = tripoProxyUrl ? new ProxyAgent(tripoProxyUrl) : undefined;

export async function generateTripoModel(run: ModelRun) {
  const apiKey = process.env.TRIPO_API_KEY;
  const concept = run.concepts.find((item) => item.id === run.selectedConceptId);
  if (!apiKey) {
    throw new Error("TRIPO_API_KEY is missing");
  }
  if (!concept) {
    throw new Error("Selected concept is missing");
  }

  const baseUrl = normalizeBaseUrl(process.env.TRIPO_BASE_URL ?? defaultBaseUrl);
  const file = await toTripoImageInput(baseUrl, apiKey, concept.imageUrl);
  const createResponse = await tripoFetch<TripoTaskResponse>(baseUrl, apiKey, ["task"], {
    method: "POST",
    body: JSON.stringify({
      type: "image_to_model",
      file,
      texture: false,
      pbr: false,
      model_version: process.env.TRIPO_MODEL_VERSION ?? "v3.1-20260211"
    })
  });

  const taskId = createResponse.task_id ?? createResponse.taskId ?? createResponse.id;
  if (!taskId) {
    throw new Error("Tripo returned no task id");
  }

  const completed = await pollTripoTask(baseUrl, apiKey, taskId);
  const modelUrl = completed.output?.model ?? completed.output?.base_model ?? completed.output?.pbr_model;
  if (!modelUrl) {
    throw new Error("Tripo task succeeded but returned no model URL");
  }

  await downloadModel(modelUrl, run.runId, "model.glb");
  return convertTripoModel(baseUrl, apiKey, taskId, run.runId);
}

async function convertTripoModel(baseUrl: string, apiKey: string, originalTaskId: string, runId: string) {
  const createResponse = await tripoFetch<TripoTaskResponse>(baseUrl, apiKey, ["task"], {
    method: "POST",
    body: JSON.stringify({
      type: "convert_model",
      original_model_task_id: originalTaskId,
      format: "STL",
      pivot_to_center_bottom: true
    })
  });

  const taskId = createResponse.task_id ?? createResponse.taskId ?? createResponse.id;
  if (!taskId) {
    throw new Error("Tripo STL conversion returned no task id");
  }

  const completed = await pollTripoTask(baseUrl, apiKey, taskId);
  const stlUrl = completed.output?.model ?? completed.output?.base_model ?? completed.output?.pbr_model;
  if (!stlUrl) {
    throw new Error("Tripo STL conversion succeeded but returned no STL URL");
  }

  return downloadModel(stlUrl, runId, "model.stl");
}

async function pollTripoTask(baseUrl: string, apiKey: string, taskId: string): Promise<TripoTaskStatus> {
  const deadline = Date.now() + pollTimeoutMs;

  while (Date.now() < deadline) {
    const task = await tripoFetch<TripoTaskStatus>(baseUrl, apiKey, ["task", taskId]);
    const status = task.status?.toLowerCase();

    if (status === "success" || status === "succeeded" || status === "completed") {
      return task;
    }
    if (status === "failed" || status === "cancelled" || status === "canceled" || status === "banned" || status === "expired") {
      throw new Error(task.error_msg ?? task.message ?? `Tripo task ${task.status}`);
    }

    await wait(pollIntervalMs);
  }

  throw new Error("Tripo task timed out");
}

async function tripoFetch<T>(baseUrl: string, apiKey: string, segments: string[], init: RequestInit = {}) {
  const response = await tripoHttpFetch(joinUrl(baseUrl, segments), {
    ...init,
    dispatcher: tripoDispatcher,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  } as TripoRequestInit).catch((error) => {
    throw new Error(`Tripo request failed before response: ${describeFetchFailure(error)}`);
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as TripoEnvelope<T> | T) : undefined;

  if (!response.ok) {
    throw new Error(`Tripo request failed: ${response.status} ${formatTripoError(json, text)}`);
  }

  if (isTripoEnvelope<T>(json)) {
    if (json.code !== 0) {
      throw new Error(`Tripo API error: ${json.message ?? json.code}${json.suggestion ? ` ${json.suggestion}` : ""}`);
    }
    if (json.data === undefined) {
      throw new Error("Tripo response was missing data");
    }
    return json.data;
  }

  if (json === undefined) {
    throw new Error("Tripo response was empty");
  }

  return json as T;
}

async function toTripoImageInput(baseUrl: string, apiKey: string, imageUrl: string): Promise<TripoImageInput> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return { type: "jpg", url: imageUrl };
  }

  if (!imageUrl.startsWith("data:image/")) {
    throw new Error("Tripo requires an HTTP image URL or data image");
  }

  const [metadata, base64] = imageUrl.split(",", 2);
  if (!base64) {
    throw new Error("Concept image data URL is invalid");
  }

  const match = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(metadata);
  if (!match) {
    throw new Error("Concept image data URL must be base64 encoded");
  }

  const token = await uploadImage(baseUrl, apiKey, Buffer.from(base64, "base64"), extensionForMime(match[1]));
  return { type: "jpg", file_token: token };
}

async function uploadImage(baseUrl: string, apiKey: string, bytes: Buffer, extension: string) {
  const form = new FormData();
  const uploadBytes = new Uint8Array(bytes.byteLength);
  uploadBytes.set(bytes);
  const blob = new Blob([uploadBytes]);
  form.append("file", blob, `concept.${extension}`);

  const response = await tripoHttpFetch(joinUrl(baseUrl, ["upload"]), {
    method: "POST",
    dispatcher: tripoDispatcher,
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  } as TripoRequestInit).catch((error) => {
    throw new Error(`Tripo image upload failed before response: ${describeFetchFailure(error)}`);
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as TripoEnvelope<{ image_token?: string; file_token?: string }>) : undefined;

  if (!response.ok || !json || json.code !== 0 || !json.data) {
    throw new Error(`Tripo image upload failed: ${response.status} ${formatTripoError(json, text)}`);
  }

  const token = json.data.image_token ?? json.data.file_token;
  if (!token) {
    throw new Error("Tripo image upload returned no token");
  }

  return token;
}

async function downloadModel(modelUrl: string, runId: string, fileName: string) {
  const response = await tripoHttpFetch(modelUrl, {
    dispatcher: tripoDispatcher
  } as TripoRequestInit).catch((error) => {
    throw new Error(`Tripo model download failed before response: ${describeFetchFailure(error)}`);
  });
  if (!response.ok) {
    throw new Error(`Tripo model download failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const ext = extensionFromUrl(modelUrl);
  const outputName = ext && !fileName.toLowerCase().endsWith(`.${ext}`) ? `model.${ext}` : fileName;
  await writeFile(path.join(getRunDir(runId), outputName), Buffer.from(arrayBuffer));
  return outputName;
}

function isTripoEnvelope<T>(value: TripoEnvelope<T> | T | undefined): value is TripoEnvelope<T> {
  return Boolean(value && typeof value === "object" && "code" in value);
}

type TripoRequestInit = RequestInit & {
  dispatcher?: Dispatcher;
};

function tripoHttpFetch(url: string, init: TripoRequestInit = {}) {
  if (tripoDispatcher) {
    return undiciFetch(url, init as Parameters<typeof undiciFetch>[1]);
  }

  return fetch(url, init);
}

function formatTripoError(json: unknown, fallback: string) {
  if (json && typeof json === "object" && "message" in json) {
    return String((json as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, segments: string[]) {
  return `${baseUrl}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function extensionFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).replace(".", "").toLowerCase();
  return ext || null;
}

function describeFetchFailure(error: unknown) {
  if (!(error instanceof Error)) return "unknown network error";

  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const code = "code" in cause ? String(cause.code) : "";
    const message = "message" in cause ? String(cause.message) : "";
    return [error.message, code, message].filter(Boolean).join(" - ");
  }

  return error.message;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
