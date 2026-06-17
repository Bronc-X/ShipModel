import "./env.js";
import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ensureRunDir, getRunDir, loadRun, persistConceptImages, publicRunFile, runsDir, saveRun } from "./storage.js";
import type { ConceptProgressEvent, ConceptResponse, GenerateModelRequest, GenerateModelResponse, HandshakeResponse, ModelJobEvent, ModelRequest, ModelRun, ReviseConceptRequest, ReviseConceptResponse } from "./types.js";
import { openAiConcepts, reviseOpenAiConcept } from "./providers/openaiImages.js";
import { generateTripoModel } from "./providers/tripoModel.js";
import { validateStl } from "./validate.js";
import { formatValidationReasons, validateInput } from "./validation.js";

const app = express();
const port = Number(process.env.PORT ?? 5174);

app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use("/runs", express.static(runsDir));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/handshake", (_request, response) => {
  const payload: HandshakeResponse = {
    ok: true,
    app: "printable-model-demo",
    apiVersion: "0.1.0",
    mode: {
      imageProvider: "openai",
      modelProvider: "tripo"
    },
    configured: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      tripo: Boolean(process.env.TRIPO_API_KEY)
    },
    capabilities: {
      conceptImages: true,
      modelGeneration: true,
      stlDownload: true,
      threeMfDownload: false,
      statuses: ["Ready", "Failed"]
    }
  };

  response.json(payload);
});

app.post("/api/concepts", async (request, response) => {
  if (String(request.headers.accept ?? "").includes("application/x-ndjson")) {
    await streamConceptProgress(request.body as ModelRequest, response);
    return;
  }

  try {
    const input = request.body as ModelRequest;
    const validation = validateInput(input);
    if (validation.length > 0) {
      response.status(400).json({
        error: "Invalid input",
        message: formatValidationReasons(validation),
        reasons: validation
      });
      return;
    }

    const runId = randomUUID();
    await ensureRunDir(runId);
    if (!process.env.OPENAI_API_KEY) {
      response.status(503).json({
        error: "OpenAI is not configured",
        message: "生成概念图前，请先设置 OPENAI_API_KEY。"
      });
      return;
    }

    const generatedConcepts = await openAiConcepts(input, runId);
    const concepts = await persistConceptImages(runId, generatedConcepts);
    const now = new Date().toISOString();
    const run: ModelRun = {
      runId,
      input,
      concepts,
      reasons: [],
      files: {},
      createdAt: now,
      updatedAt: now
    };

    await saveRun(run);
    const payload: ConceptResponse = { runId, concepts };
    response.json(payload);
  } catch (error) {
    response.status(500).json({
      error: "Concept generation failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

async function streamConceptProgress(input: ModelRequest, response: express.Response) {
  response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("X-Accel-Buffering", "no");

  const send = (event: ConceptProgressEvent) => {
    response.write(`${JSON.stringify(event)}\n`);
  };

  try {
    send({ phase: "queued", progress: 5, message: "已接收概念图生成请求。" });

    const validation = validateInput(input);
    if (validation.length > 0) {
      response.status(400);
      send({ phase: "complete", progress: 100, message: formatValidationReasons(validation) });
      response.end();
      return;
    }

    send({ phase: "validating", progress: 12, message: "参数校验通过，正在创建生成记录。" });
    const runId = randomUUID();
    await ensureRunDir(runId);
    send({ phase: "image", progress: 22, message: "正在生成概念图。", runId, conceptIndex: 1, totalConcepts: 1 });

    if (!process.env.OPENAI_API_KEY) {
      response.status(503);
      send({ phase: "complete", progress: 100, message: "生成概念图前，请先设置 OPENAI_API_KEY。", runId });
      response.end();
      return;
    }

    const generatedConcepts = await openAiConcepts(input, runId, {
      onConceptDone: (_concept, index, total) => {
        const progress = index < total ? 56 : 84;
        const nextMessage = "概念图已完成，正在保存结果。";
        send({ phase: "image", progress, message: nextMessage, runId, conceptIndex: index, totalConcepts: total });
      }
    });
    const concepts = await persistConceptImages(runId, generatedConcepts);

    send({ phase: "saving", progress: 92, message: "正在保存概念图和生成记录。", runId, totalConcepts: concepts.length });

    const now = new Date().toISOString();
    const run: ModelRun = {
      runId,
      input,
      concepts,
      reasons: [],
      files: {},
      createdAt: now,
      updatedAt: now
    };

    await saveRun(run);
    const payload: ConceptResponse = { runId, concepts };
    send({ phase: "complete", progress: 100, message: "概念图已生成。", runId, totalConcepts: concepts.length, response: payload });
  } catch (error) {
    send({
      phase: "complete",
      progress: 100,
      message: error instanceof Error ? error.message : "Concept generation failed"
    });
  } finally {
    response.end();
  }
}

app.post("/api/concepts/revise", async (request, response) => {
  try {
    const body = request.body as ReviseConceptRequest;
    const run = await loadRun(body.runId);
    const concept = run.concepts.find((item) => item.id === body.conceptId);
    if (!concept) {
      response.status(404).json({ error: "Concept not found" });
      return;
    }
    if (!process.env.OPENAI_API_KEY) {
      response.status(503).json({
        error: "OpenAI is not configured",
        message: "修改概念图前，请先设置 OPENAI_API_KEY。"
      });
      return;
    }

    const revised = await reviseOpenAiConcept(run.input, concept, body.instruction);
    const [persistedConcept] = await persistConceptImages(run.runId, [revised]);
    const nextConcept = persistedConcept ?? revised;
    run.concepts = [nextConcept, ...run.concepts.filter((item) => item.id !== concept.id)];
    run.selectedConceptId = nextConcept.id;
    run.updatedAt = new Date().toISOString();
    await saveRun(run);

    const payload: ReviseConceptResponse = { run, concept: nextConcept };
    response.json(payload);
  } catch (error) {
    response.status(500).json({
      error: "Concept revision failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.post("/api/models", async (request, response) => {
  if (String(request.headers.accept ?? "").includes("application/x-ndjson")) {
    await streamModelProgress(request.body as GenerateModelRequest, response);
    return;
  }

  try {
    const payload = await runModelGeneration(request.body as GenerateModelRequest);
    response.json(payload);
  } catch (error) {
    response.status(500).json({
      error: "Model generation failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

async function streamModelProgress(body: GenerateModelRequest, response: express.Response) {
  response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("X-Accel-Buffering", "no");

  const jobId = body.runId;
  const send = (event: ModelJobEvent) => {
    response.write(`${JSON.stringify(event)}\n`);
  };
  const emit = async (event: ModelJobEvent) => {
    send(event);
  };

  try {
    const payload = await runModelGeneration(body, emit);
    send({ type: "job.completed", jobId, at: new Date().toISOString(), response: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model generation failed";
    send({ type: "step.failed", jobId, stepId: "model_generation", error: message, recoverable: true, at: new Date().toISOString() });
    send({ type: "job.completed", jobId, at: new Date().toISOString() });
  } finally {
    response.end();
  }
}

async function runModelGeneration(body: GenerateModelRequest, emit?: (event: ModelJobEvent) => Promise<void>): Promise<GenerateModelResponse> {
  const run = await loadRun(body.runId);
  const jobId = run.runId;
  const at = () => new Date().toISOString();
  const send = async (event: ModelJobEvent) => {
    await emit?.(event);
  };

  await send({ type: "job.started", jobId, title: "生成 STL 模型", at: at() });

  const concept = run.concepts.find((item) => item.id === body.conceptId);
  if (!concept) {
    throw new Error("Concept not found");
  }

  await send({ type: "step.started", jobId, stepId: "select_concept", title: "锁定概念图和打印参数", at: at() });
  run.selectedConceptId = body.conceptId;
  run.reasons = [];
  await send({ type: "tool.completed", jobId, callId: "select_concept", name: "select_concept", outputSummary: `${run.input.category} / ${run.input.targetLengthMm}mm`, at: at() });

  try {
    if (!process.env.TRIPO_API_KEY) {
      throw new Error("生成可打印模型前，请先设置 TRIPO_API_KEY。");
    }

    await send({ type: "tool.started", jobId, callId: "tripo_generate_model", name: "tripo_image_to_model", inputSummary: concept.title, at: at() });
    const stlFile = await generateTripoModel(run, async (event) => {
      await send({ ...event, jobId, at: at() });
    });
    await send({ type: "tool.completed", jobId, callId: "tripo_generate_model", name: "tripo_image_to_model", outputSummary: stlFile.fileName, at: at() });

    await send({ type: "tool.started", jobId, callId: "validate_stl", name: "validate_stl", inputSummary: stlFile.fileName, at: at() });
    const reasons = await validateStl(run.runId, stlFile.fileName);

    if (reasons.length > 0) {
      run.status = "Failed";
      run.reasons = reasons;
      run.files = {};
      await send({ type: "step.failed", jobId, stepId: "validate_stl", error: reasons.join("；"), recoverable: true, at: at() });
    } else {
      run.status = "Ready";
      run.reasons = [];
      run.files = {
        stl: publicRunFile(run.runId, stlFile.fileName),
        stlSourceUrl: stlFile.sourceUrl
      };
      await send({ type: "tool.completed", jobId, callId: "validate_stl", name: "validate_stl", outputSummary: "STL 文件通过基础校验", at: at() });
      await send({
        type: "artifact.created",
        jobId,
        artifactId: `${run.runId}:stl`,
        kind: "stl",
        title: "可下载 STL 文件",
        data: { href: run.files.stl },
        at: at()
      });
    }
  } catch (error) {
    run.status = "Failed";
    run.reasons = [error instanceof Error ? error.message : "model_generation_failed"];
    run.files = {};
    await send({ type: "step.failed", jobId, stepId: "model_generation", error: run.reasons[0], recoverable: true, at: at() });
  }

  await send({ type: "tool.started", jobId, callId: "save_run", name: "save_run", inputSummary: run.status ?? "unknown", at: at() });
  await saveRun(run);
  await send({ type: "tool.completed", jobId, callId: "save_run", name: "save_run", outputSummary: `状态：${run.status ?? "unknown"}`, at: at() });

  return { run };
}

app.get("/api/runs/:runId", async (request, response) => {
  try {
    const run = await loadRun(request.params.runId);
    response.json({ run });
  } catch {
    response.status(404).json({ error: "Run not found" });
  }
});

app.get("/api/runs/:runId/download/stl", async (request, response) => {
  const sourceUrl = getAllowedSourceUrl(String(request.query.source ?? ""));
  try {
    const run = await loadRun(request.params.runId);
    if (run.status !== "Ready" || !run.files.stl) {
      response.status(404).json({ error: "STL is not ready" });
      return;
    }
    if (sourceUrl) {
      await pipeRemoteStl(sourceUrl, run.runId, response);
      return;
    }
    response.download(path.join(getRunDir(run.runId), path.basename(run.files.stl)), `${run.runId}.stl`);
  } catch {
    if (sourceUrl) {
      await pipeRemoteStl(sourceUrl, request.params.runId, response);
      return;
    }
    response.status(404).json({ error: "Run not found" });
  }
});

function getAllowedSourceUrl(source: string) {
  if (!source) return null;

  try {
    const url = new URL(source);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (!host.endsWith(".tripo3d.com") && !host.endsWith(".tripo3d.ai")) return null;
    if (!url.pathname.toLowerCase().endsWith(".stl")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function pipeRemoteStl(sourceUrl: string, runId: string, response: express.Response) {
  const remoteResponse = await fetch(sourceUrl);
  if (!remoteResponse.ok || !remoteResponse.body) {
    response.status(502).json({ error: `Remote STL fetch failed: ${remoteResponse.status}` });
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Cache-Control", "private, max-age=3600");
  response.setHeader("Content-Disposition", `attachment; filename="${runId}.stl"`);
  response.setHeader("Content-Type", "model/stl");
  const bytes = Buffer.from(await remoteResponse.arrayBuffer());
  response.send(bytes);
}

app.listen(port, () => {
  process.stdout.write(`Printable model API listening on http://localhost:${port}\n`);
});
