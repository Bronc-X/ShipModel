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

export type TripoModelProgressEvent =
  | { type: "tool.started"; callId: string; name: string; inputSummary?: string }
  | { type: "tool.completed"; callId: string; name: string; outputSummary?: string };

type TripoModelProgress = (event: TripoModelProgressEvent) => Promise<void> | void;

const defaultBaseUrl = "https://api.tripo3d.ai/v2/openapi";
const tripoProxyUrl = process.env.TRIPO_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const tripoDispatcher = tripoProxyUrl ? new ProxyAgent(tripoProxyUrl) : undefined;

export function getTripoOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    pollIntervalMs: parsePositiveInt(env.TRIPO_POLL_INTERVAL_MS, 3000),
    pollTimeoutMs: parsePositiveInt(env.TRIPO_POLL_TIMEOUT_MS, 1000 * 60 * 10),
    downloadIntermediateGlb: env.TRIPO_DOWNLOAD_INTERMEDIATE_GLB === "true"
  };
}

export async function generateTripoModel(run: ModelRun, emit?: TripoModelProgress) {
  const apiKey = process.env.TRIPO_API_KEY;
  const concept = run.concepts.find((item) => item.id === run.selectedConceptId);
  const options = getTripoOptions();
  if (!apiKey) {
    throw new Error("TRIPO_API_KEY is missing");
  }
  if (!concept) {
    throw new Error("Selected concept is missing");
  }

  const baseUrl = normalizeBaseUrl(process.env.TRIPO_BASE_URL ?? defaultBaseUrl);
  await emitProgress(emit, { type: "tool.started", callId: "tripo_prepare_image", name: "prepare_tripo_image", inputSummary: concept.title });
  const file = await toTripoImageInput(baseUrl, apiKey, concept.imageUrl, emit);
  await emitProgress(emit, {
    type: "tool.completed",
    callId: "tripo_prepare_image",
    name: "prepare_tripo_image",
    outputSummary: file.url ? "使用远程概念图 URL" : "概念图已上传为 Tripo file_token"
  });

  await emitProgress(emit, { type: "tool.started", callId: "tripo_create_model_task", name: "tripo_create_model_task", inputSummary: "image_to_model" });
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
  await emitProgress(emit, { type: "tool.completed", callId: "tripo_create_model_task", name: "tripo_create_model_task", outputSummary: `建模任务 ${taskId}` });

  const completed = await pollTripoTask(baseUrl, apiKey, taskId, "tripo_poll_model_task", "tripo_poll_model_task", options, emit);
  const modelUrl = completed.output?.model ?? completed.output?.base_model ?? completed.output?.pbr_model;
  if (!modelUrl) {
    throw new Error("Tripo task succeeded but returned no model URL");
  }

  if (options.downloadIntermediateGlb) {
    await emitProgress(emit, { type: "tool.started", callId: "tripo_download_model_asset", name: "tripo_download_model_asset", inputSummary: "GLB source asset" });
    await downloadModel(modelUrl, run.runId, "model.glb");
    await emitProgress(emit, { type: "tool.completed", callId: "tripo_download_model_asset", name: "tripo_download_model_asset", outputSummary: "model.glb" });
  } else {
    await emitProgress(emit, { type: "tool.completed", callId: "tripo_skip_glb_download", name: "tripo_skip_glb_download", outputSummary: "跳过中间 GLB 下载，直接提交 STL 转换。" });
  }

  return convertTripoModel(baseUrl, apiKey, taskId, run.runId, options, emit);
}

async function convertTripoModel(baseUrl: string, apiKey: string, originalTaskId: string, runId: string, options: ReturnType<typeof getTripoOptions>, emit?: TripoModelProgress) {
  await emitProgress(emit, { type: "tool.started", callId: "tripo_create_stl_task", name: "tripo_create_stl_task", inputSummary: originalTaskId });
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
  await emitProgress(emit, { type: "tool.completed", callId: "tripo_create_stl_task", name: "tripo_create_stl_task", outputSummary: `STL 转换任务 ${taskId}` });

  const completed = await pollTripoTask(baseUrl, apiKey, taskId, "tripo_poll_stl_task", "tripo_poll_stl_task", options, emit);
  const stlUrl = completed.output?.model ?? completed.output?.base_model ?? completed.output?.pbr_model;
  if (!stlUrl) {
    throw new Error("Tripo STL conversion succeeded but returned no STL URL");
  }

  await emitProgress(emit, { type: "tool.started", callId: "tripo_download_stl", name: "tripo_download_stl", inputSummary: "STL asset" });
  const stlFile = await downloadModel(stlUrl, runId, "model.stl");
  await emitProgress(emit, { type: "tool.completed", callId: "tripo_download_stl", name: "tripo_download_stl", outputSummary: stlFile });
  return stlFile;
}

async function pollTripoTask(baseUrl: string, apiKey: string, taskId: string, callId: string, name: string, options: ReturnType<typeof getTripoOptions>, emit?: TripoModelProgress): Promise<TripoTaskStatus> {
  const deadline = Date.now() + options.pollTimeoutMs;
  let pollCount = 0;

  await emitProgress(emit, { type: "tool.started", callId, name, inputSummary: taskId });

  while (Date.now() < deadline) {
    const task = await tripoFetch<TripoTaskStatus>(baseUrl, apiKey, ["task", taskId]);
    const status = task.status?.toLowerCase();
    pollCount += 1;
    await emitProgress(emit, {
      type: "tool.completed",
      callId: `${callId}:${pollCount}`,
      name: `${name}_status`,
      outputSummary: `${taskId}: ${task.status ?? "unknown"}`
    });

    if (status === "success" || status === "succeeded" || status === "completed") {
      await emitProgress(emit, { type: "tool.completed", callId, name, outputSummary: `${taskId}: ${task.status ?? "success"}` });
      return task;
    }
    if (status === "failed" || status === "cancelled" || status === "canceled" || status === "banned" || status === "expired") {
      throw new Error(task.error_msg ?? task.message ?? `Tripo task ${task.status}`);
    }

    await wait(options.pollIntervalMs);
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

async function toTripoImageInput(baseUrl: string, apiKey: string, imageUrl: string, emit?: TripoModelProgress): Promise<TripoImageInput> {
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

  const token = await uploadImage(baseUrl, apiKey, Buffer.from(base64, "base64"), extensionForMime(match[1]), emit);
  return { type: "jpg", file_token: token };
}

async function uploadImage(baseUrl: string, apiKey: string, bytes: Buffer, extension: string, emit?: TripoModelProgress) {
  const form = new FormData();
  const uploadBytes = new Uint8Array(bytes.byteLength);
  uploadBytes.set(bytes);
  const blob = new Blob([uploadBytes]);
  form.append("file", blob, `concept.${extension}`);

  await emitProgress(emit, { type: "tool.started", callId: "tripo_upload_image", name: "tripo_upload_image", inputSummary: `concept.${extension}` });
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

  await emitProgress(emit, { type: "tool.completed", callId: "tripo_upload_image", name: "tripo_upload_image", outputSummary: "file_token ready" });
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

async function emitProgress(emit: TripoModelProgress | undefined, event: TripoModelProgressEvent) {
  await emit?.(event);
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
